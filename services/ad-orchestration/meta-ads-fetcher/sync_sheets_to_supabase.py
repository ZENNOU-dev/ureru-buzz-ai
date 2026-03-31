"""Sync CRs from Google Sheets 【制作DB】 directly to Supabase.

Bypasses Notion for faster, simpler sync.
Reads rows from the spreadsheet, deduplicates by CR名,
resolves 案件名 → project_id, and upserts into creatives table.

Usage:
    python sync_sheets_to_supabase.py              # full sync
    python sync_sheets_to_supabase.py --dry-run     # preview only
"""

import os
import re
import logging
import argparse
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---- Config ----
SPREADSHEET_ID = "14m-MkXkk2YobmkNYFA_huD7VkE08Df6gZ0Pf8X6pey8"
SHEET_TAB = "【制作DB】"
START_ROW = 2508

# Known 担当者 prefixes (extracted from CR名 before first _)
KNOWN_PERSONS = {"渋谷", "松永", "奥山", "北川", "羽田", "三島", "藤井", "束河", "横野"}

# Sheet project names that differ from Supabase project names
PROJECT_NAME_MAP = {
    ".AI": "DOT-AI",
    "バルクオムヘアケア": "バルクオムシャンプー",
    "Brighteエレキブラシ": "Brigteエレキブラシ",
}


def read_sheets_data(start_row: int = START_ROW) -> list[list[str]]:
    """Read all rows from the sheet starting at start_row.

    Uses service account credentials (gspread) or GOOGLE_API_KEY as fallback.
    """
    import gspread

    creds_path = os.getenv(
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        os.path.expanduser("~/bonnou_rpa/bonnou_rpa/credentials.json"),
    )

    if not os.path.exists(creds_path):
        logger.error(f"Service account credentials not found: {creds_path}")
        return []

    gc = gspread.service_account(filename=creds_path)
    spreadsheet = gc.open_by_key(SPREADSHEET_ID)
    worksheet = spreadsheet.worksheet(SHEET_TAB)

    # Get all values from start_row onwards
    all_values = worksheet.get(f"A{start_row}:G")

    all_rows = []
    date_pattern = re.compile(r'^20\d{2}/\d{1,2}/\d{1,2}$')

    for row in all_values:
        if len(row) >= 6 and date_pattern.match(row[0]) and row[5].strip():
            all_rows.append(row)

    logger.info(f"Read {len(all_rows)} valid rows from Google Sheets (from row {start_row})")
    return all_rows


def infer_person(cr_name: str, sheet_person: str) -> str:
    """Infer 担当者 from sheet column or CR名 prefix."""
    if sheet_person and sheet_person.strip():
        return sheet_person.strip()
    if "_" in cr_name:
        prefix = cr_name.split("_")[0]
        if prefix in KNOWN_PERSONS:
            return prefix
    return ""


def get_project_name_to_id() -> dict[str, int]:
    """Build project_name → project_id mapping from Supabase."""
    from database import get_client
    sb = get_client()
    result = sb.table("projects").select("id, name").execute()
    mapping = {}
    for row in result.data:
        if row.get("name"):
            mapping[row["name"]] = row["id"]
    return mapping


def get_existing_creative_names() -> set[str]:
    """Get all CR names already in Supabase."""
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


def process_rows(
    rows: list[list[str]],
    project_mapping: dict[str, int],
    existing_crs: set[str],
) -> list[dict]:
    """Process raw sheet rows into unique CR records for Supabase upsert.

    Each row: [date, 案件名, genre, 担当者, concept, CR名, CR URL]
    """
    seen = {}
    for row in rows:
        if len(row) < 6:
            continue

        cr_name = row[5].strip()
        if not cr_name:
            continue

        # Skip existing
        if cr_name in existing_crs:
            continue

        # Deduplicate: keep first occurrence
        if cr_name in seen:
            continue

        project_name = row[1].strip() if len(row) > 1 else ""
        sheet_person = row[3].strip() if len(row) > 3 else ""
        cr_url = row[6].strip() if len(row) > 6 else ""

        person = infer_person(cr_name, sheet_person)
        mapped_name = PROJECT_NAME_MAP.get(project_name, project_name)
        project_id = project_mapping.get(mapped_name)

        record = {
            "creative_name": cr_name,
            "person_in_charge": person or None,
        }

        if cr_url:
            record["cr_url"] = cr_url
        if project_id:
            record["project_id"] = project_id

        seen[cr_name] = record

    return list(seen.values())


def sync(dry_run: bool = False) -> dict:
    """Run full sync: Sheets → Supabase creatives.

    Returns: {"total_rows", "new_records", "upserted", "errors", "unmatched_projects"}
    """
    from database import get_client, upsert_creatives

    logger.info("=== Sheets → Supabase Direct Sync ===")

    # 1. Read sheet
    rows = read_sheets_data()
    if not rows:
        logger.info("No rows to process.")
        return {"total_rows": 0, "new_records": 0, "upserted": 0, "errors": []}

    # 2. Get mappings
    project_mapping = get_project_name_to_id()
    logger.info(f"Projects in DB: {len(project_mapping)}")

    existing_crs = get_existing_creative_names()
    logger.info(f"Existing CRs in Supabase: {len(existing_crs)}")

    # 3. Process
    records = process_rows(rows, project_mapping, existing_crs)
    logger.info(f"New unique CRs to sync: {len(records)}")

    if not records:
        logger.info("No new CRs to sync.")
        return {"total_rows": len(rows), "new_records": 0, "upserted": 0, "errors": []}

    # Summary
    matched = sum(1 for r in records if r.get("project_id"))
    unmatched_projects = set()
    for row in rows:
        if len(row) > 1:
            pn = row[1].strip()
            mapped = PROJECT_NAME_MAP.get(pn, pn)
            if mapped not in project_mapping:
                unmatched_projects.add(pn)

    logger.info(f"Project match: {matched}/{len(records)}")
    if unmatched_projects:
        logger.warning(f"Unmatched projects: {unmatched_projects}")

    with_person = sum(1 for r in records if r.get("person_in_charge"))
    logger.info(f"With 担当者: {with_person}/{len(records)}")

    if dry_run:
        logger.info("--- DRY RUN ---")
        for i, rec in enumerate(records[:20], 1):
            logger.info(f"  [{i}] {rec['creative_name']} | project_id={rec.get('project_id')} | {rec.get('person_in_charge', '-')}")
        if len(records) > 20:
            logger.info(f"  ... and {len(records) - 20} more")
        return {
            "total_rows": len(rows),
            "new_records": len(records),
            "upserted": 0,
            "errors": [],
            "unmatched_projects": list(unmatched_projects),
        }

    # 4. Upsert to Supabase
    sb = get_client()
    upserted = upsert_creatives(sb, records)
    logger.info(f"Upserted {upserted}/{len(records)} CRs to Supabase")

    return {
        "total_rows": len(rows),
        "new_records": len(records),
        "upserted": upserted,
        "errors": [],
        "unmatched_projects": list(unmatched_projects),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync CRs from Google Sheets to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no writes")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    result = sync(dry_run=args.dry_run)
    print(f"\nResult: {result}")
