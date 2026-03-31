"""Sync CRs from Google Sheets 【制作DB】 to Notion Creative Database.

Reads rows from the specified sheet starting at a configurable row,
deduplicates by CR名, infers 担当者 from CR名 prefix if missing,
resolves 案件名 → 案件DB relation, and creates/updates Notion pages.

Can be run standalone or called from the main pipeline.
"""

import os
import json
import logging
import time
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---- Config ----
SPREADSHEET_ID = "14m-MkXkk2YobmkNYFA_huD7VkE08Df6gZ0Pf8X6pey8"
SHEET_TAB = "【制作DB】"
START_ROW = 2508

# Notion
NOTION_DB_PROJECTS = "3264996376a28039979ee97dc86b17fa"
NOTION_DB_CREATIVES = "360608fc98f545ab9cd2d586b130e1b0"

# Known 担当者 prefixes (extracted from CR名 before first _)
KNOWN_PERSONS = {"渋谷", "松永", "奥山", "北川", "羽田", "三島", "藤井", "束河", "横野"}

# Sheet project names that differ from Notion names
PROJECT_NAME_MAP = {
    ".AI": "DOT-AI",
    "バルクオムヘアケア": "バルクオムシャンプー",
    "Brighteエレキブラシ": "Brigteエレキブラシ",
}

# State file to track last synced row
STATE_FILE = os.path.join(os.path.dirname(__file__), ".sheets_sync_state.json")


def _notion_headers() -> dict:
    token = os.getenv("NOTION_API_TOKEN")
    if not token:
        raise ValueError("NOTION_API_TOKEN is required.")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def _sheets_headers() -> dict:
    token = os.getenv("GOOGLE_SHEETS_API_KEY", "")
    # We'll use the Google Sheets API via service account or API key
    # For this script, we use the gspread approach or direct REST
    return {}


# ---- Google Sheets reading via REST API ----

def read_sheets_data(start_row: int = START_ROW) -> list[list[str]]:
    """Read all rows from the sheet starting at start_row.

    Uses Google Sheets API v4 with API key.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set. Falling back to sheets_data.json if available.")
        data_file = os.path.join(os.path.dirname(__file__), "sheets_data.json")
        if os.path.exists(data_file):
            import json as _json
            with open(data_file) as f:
                return _json.load(f)
        return []

    import re
    from googleapiclient.discovery import build

    service = build("sheets", "v4", developerKey=api_key)
    sheet = service.spreadsheets()

    all_rows = []
    batch_size = 500
    current_row = start_row

    while True:
        range_str = f"'【制作DB】'!A{current_row}:G{current_row + batch_size - 1}"
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=range_str,
        ).execute()

        values = result.get("values", [])
        if not values:
            break

        # Filter valid rows (date in first column, CR名 in 6th column)
        date_pattern = re.compile(r'^20\d{2}/\d{1,2}/\d{1,2}$')
        for row in values:
            if len(row) >= 6 and date_pattern.match(row[0]) and row[5].strip():
                all_rows.append(row)

        current_row += batch_size
        if len(values) < batch_size:
            break

    logger.info(f"  Read {len(all_rows)} valid rows from Google Sheets (from row {start_row})")
    return all_rows


# ---- Notion helpers ----

def get_project_name_to_page_id() -> dict[str, str]:
    """Query Notion 案件DB to build project_name → page_id mapping."""
    headers = _notion_headers()
    mapping = {}
    has_more = True
    start_cursor = None

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{NOTION_DB_PROJECTS}/query",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

        for page in data.get("results", []):
            if page.get("in_trash"):
                continue
            props = page["properties"]
            # Title property is "名前"
            title_items = props.get("名前", {}).get("title", [])
            name = title_items[0].get("plain_text", "") if title_items else ""
            if name:
                mapping[name] = page["id"]

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return mapping


def get_existing_creative_names() -> set[str]:
    """Get all CR名 from Supabase creatives table (fast, <1sec for 2000+ rows).

    Previously fetched from Notion (2000+ pages, took minutes).
    Supabase is the source of truth after sync.
    """
    from database import get_client
    sb = get_client()
    names = set()
    offset = 0
    batch = 1000
    while True:
        result = sb.table("creatives").select("creative_name").range(offset, offset + batch - 1).execute()
        for row in result.data:
            if row.get("creative_name"):
                names.add(row["creative_name"])
        if len(result.data) < batch:
            break
        offset += batch
    return names


def infer_person(cr_name: str, sheet_person: str) -> str:
    """Infer 担当者 from sheet column or CR名 prefix."""
    if sheet_person and sheet_person.strip():
        return sheet_person.strip()

    # CR名 format: {担当者}_{concept}_{variant}...
    if "_" in cr_name:
        prefix = cr_name.split("_")[0]
        if prefix in KNOWN_PERSONS:
            return prefix

    return ""


def create_notion_creative(
    cr_name: str,
    project_page_id: str | None,
    cr_url: str,
    person_in_charge: str,
) -> str | None:
    """Create a page in the Notion Creative Database. Returns page ID."""
    headers = _notion_headers()

    properties = {
        "CR名": {
            "title": [{"text": {"content": cr_name}}]
        },
    }

    if cr_url and cr_url.strip():
        properties["CR URL"] = {"url": cr_url.strip()}

    if person_in_charge:
        properties["担当者"] = {
            "rich_text": [{"text": {"content": person_in_charge}}]
        }

    if project_page_id:
        properties["案件DB"] = {
            "relation": [{"id": project_page_id}]
        }

    body = {
        "parent": {"database_id": NOTION_DB_CREATIVES},
        "properties": properties,
    }

    resp = requests.post(
        "https://api.notion.com/v1/pages",
        headers=headers,
        json=body,
    )

    if resp.status_code == 200:
        return resp.json()["id"]
    else:
        logger.error(f"Failed to create CR '{cr_name}': {resp.status_code} {resp.text}")
        return None


def process_sheet_rows(rows: list[list[str]], project_mapping: dict[str, str], existing_crs: set[str]) -> list[dict]:
    """Process raw sheet rows into unique CR records.

    Each row: [date, 案件名, genre, 担当者, concept, CR名, CR URL]
    Columns: A=date, B=案件名, C=genre, D=担当者, E=concept, F=CR名, G=CR URL
    """
    seen = {}
    for row in rows:
        if len(row) < 6:
            continue

        cr_name = row[5].strip() if len(row) > 5 else ""
        if not cr_name:
            continue

        # Skip if already in Notion
        if cr_name in existing_crs:
            continue

        # Deduplicate: keep first occurrence
        if cr_name in seen:
            continue

        project_name = row[1].strip() if len(row) > 1 else ""
        sheet_person = row[3].strip() if len(row) > 3 else ""
        cr_url = row[6].strip() if len(row) > 6 else ""

        person = infer_person(cr_name, sheet_person)
        # Map sheet project name to Notion project name if needed
        mapped_name = PROJECT_NAME_MAP.get(project_name, project_name)
        project_page_id = project_mapping.get(mapped_name)

        seen[cr_name] = {
            "cr_name": cr_name,
            "project_name": project_name,
            "project_page_id": project_page_id,
            "cr_url": cr_url,
            "person_in_charge": person,
        }

    return list(seen.values())


def migrate_to_notion(records: list[dict], dry_run: bool = False) -> int:
    """Create Notion pages for each CR record. Returns count of created pages."""
    created = 0
    total = len(records)

    for i, rec in enumerate(records, 1):
        if dry_run:
            logger.info(f"  [DRY RUN] {i}/{total} {rec['cr_name']} | {rec['project_name']} | {rec['person_in_charge']}")
            created += 1
            continue

        page_id = create_notion_creative(
            cr_name=rec["cr_name"],
            project_page_id=rec["project_page_id"],
            cr_url=rec["cr_url"],
            person_in_charge=rec["person_in_charge"],
        )

        if page_id:
            created += 1
            if i % 20 == 0:
                logger.info(f"  Progress: {i}/{total} ({created} created)")
            # Rate limit: Notion API allows 3 req/sec
            time.sleep(0.35)
        else:
            logger.warning(f"  Failed: {rec['cr_name']}")
            time.sleep(1)

    return created


# ---- State management for incremental sync ----

def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"last_row": START_ROW}


def save_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


# ---- Main entry points ----

def run_migration(rows: list[list[str]], dry_run: bool = False) -> int:
    """Run the full migration given pre-fetched sheet rows.

    Args:
        rows: Raw rows from Google Sheets (each row is [date, project, genre, person, concept, cr_name, cr_url])
        dry_run: If True, log what would be created without actually creating.

    Returns:
        Number of CRs created in Notion.
    """
    logger.info("=== Sheets → Notion CR Migration ===")
    logger.info(f"  Input rows: {len(rows)}")

    # Get project mapping from Notion
    logger.info("  Fetching project mapping from Notion 案件DB...")
    project_mapping = get_project_name_to_page_id()
    logger.info(f"  Found {len(project_mapping)} projects: {list(project_mapping.keys())}")

    # Get existing CRs in Notion
    logger.info("  Fetching existing CRs from Notion Creative Database...")
    existing_crs = get_existing_creative_names()
    logger.info(f"  Found {len(existing_crs)} existing CRs in Notion")

    # Process rows
    records = process_sheet_rows(rows, project_mapping, existing_crs)
    logger.info(f"  New unique CRs to create: {len(records)}")

    if not records:
        logger.info("  No new CRs to migrate.")
        return 0

    # Show project match summary
    matched = sum(1 for r in records if r["project_page_id"])
    unmatched_projects = set(r["project_name"] for r in records if not r["project_page_id"])
    logger.info(f"  Project match: {matched}/{len(records)}")
    if unmatched_projects:
        logger.warning(f"  Unmatched projects: {unmatched_projects}")

    # Show person inference summary
    with_person = sum(1 for r in records if r["person_in_charge"])
    logger.info(f"  With 担当者: {with_person}/{len(records)}")

    # Migrate
    created = migrate_to_notion(records, dry_run=dry_run)
    logger.info(f"  Migration complete: {created}/{len(records)} CRs created")

    return created


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    # When run standalone, just test the project mapping and existing CRs
    logger.info("Testing Notion connectivity...")
    pm = get_project_name_to_page_id()
    logger.info(f"Projects: {list(pm.keys())}")

    existing = get_existing_creative_names()
    logger.info(f"Existing CRs: {len(existing)}")
