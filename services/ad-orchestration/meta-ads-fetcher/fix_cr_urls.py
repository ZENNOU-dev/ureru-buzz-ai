"""Fix CR URLs in sheets_data.json and Notion.

Problem: 885 rows in sheets_data.json have filenames (e.g. "xxx.mp4") instead
of real URLs in the CR URL field (index 6). The source Google Sheet also has
filenames in those cells -- the URLs were never entered.

This script:
1. Clears invalid CR URLs (non-http values) in sheets_data.json
2. Queries Notion Creative DB for pages with those CR names
3. Clears the CR URL on any Notion page that has a non-http value
"""

import os
import json
import time
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

NOTION_DB_CREATIVES = "360608fc98f545ab9cd2d586b130e1b0"
SHEETS_DATA_PATH = os.path.join(os.path.dirname(__file__), "sheets_data.json")


def _notion_headers() -> dict:
    token = os.getenv("NOTION_API_TOKEN")
    if not token:
        raise ValueError("NOTION_API_TOKEN is required.")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def fix_sheets_data() -> list[str]:
    """Clear non-URL values in CR URL field of sheets_data.json.

    Returns list of CR names that were fixed.
    """
    with open(SHEETS_DATA_PATH) as f:
        data = json.load(f)

    fixed_names = []
    for row in data:
        if len(row) > 6 and row[6] and not row[6].startswith("http"):
            cr_name = row[5].strip()
            old_val = row[6]
            row[6] = ""
            fixed_names.append(cr_name)
            logger.debug(f"  Cleared: {cr_name} (was: {old_val})")

    with open(SHEETS_DATA_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"Fixed {len(fixed_names)} rows in sheets_data.json")
    return fixed_names


def find_notion_pages_with_bad_urls(cr_names: set[str]) -> list[dict]:
    """Query Notion Creative DB and find pages with non-URL CR URLs.

    Returns list of {page_id, cr_name, bad_url} dicts.
    """
    headers = _notion_headers()
    bad_pages = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{NOTION_DB_CREATIVES}/query",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

        for page in data.get("results", []):
            if page.get("in_trash"):
                continue
            props = page["properties"]

            # Get CR name
            title_items = props.get("CR名", {}).get("title", [])
            name = title_items[0].get("plain_text", "") if title_items else ""
            if not name:
                continue

            # Check CR URL
            cr_url = props.get("CR URL", {}).get("url", "") or ""
            if cr_url and not cr_url.startswith("http"):
                bad_pages.append({
                    "page_id": page["id"],
                    "cr_name": name,
                    "bad_url": cr_url,
                })
            elif name in cr_names and not cr_url:
                # Already empty, no fix needed
                pass

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return bad_pages


def clear_notion_cr_urls(bad_pages: list[dict], dry_run: bool = False) -> int:
    """Clear CR URL on Notion pages that have non-URL values.

    Returns count of pages updated.
    """
    headers = _notion_headers()
    updated = 0

    for i, page_info in enumerate(bad_pages, 1):
        if dry_run:
            logger.info(
                f"  [DRY RUN] {i}/{len(bad_pages)} "
                f"Clear CR URL for '{page_info['cr_name']}' "
                f"(was: {page_info['bad_url']})"
            )
            updated += 1
            continue

        resp = requests.patch(
            f"https://api.notion.com/v1/pages/{page_info['page_id']}",
            headers=headers,
            json={
                "properties": {
                    "CR URL": {"url": None},
                }
            },
        )

        if resp.status_code == 200:
            updated += 1
            if i % 20 == 0:
                logger.info(f"  Progress: {i}/{len(bad_pages)} ({updated} updated)")
            time.sleep(0.35)
        else:
            logger.error(
                f"  Failed to update '{page_info['cr_name']}': "
                f"{resp.status_code} {resp.text}"
            )
            time.sleep(1)

    return updated


def main(dry_run: bool = False):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    logger.info("=== Fix CR URLs ===")

    # Step 1: Fix sheets_data.json
    logger.info("Step 1: Fixing sheets_data.json...")
    fixed_names = fix_sheets_data()
    logger.info(f"  Cleared {len(fixed_names)} invalid CR URLs in sheets_data.json")

    # Step 2: Find and fix Notion pages
    logger.info("Step 2: Querying Notion for pages with bad CR URLs...")
    cr_name_set = set(fixed_names)
    bad_pages = find_notion_pages_with_bad_urls(cr_name_set)
    logger.info(f"  Found {len(bad_pages)} Notion pages with non-URL CR URLs")

    if bad_pages:
        logger.info("Step 3: Clearing bad CR URLs in Notion...")
        updated = clear_notion_cr_urls(bad_pages, dry_run=dry_run)
        logger.info(f"  Updated {updated}/{len(bad_pages)} Notion pages")
    else:
        logger.info("  No Notion pages need updating.")

    logger.info("=== Done ===")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fix non-URL CR URLs in sheets_data.json and Notion")
    parser.add_argument("--dry-run", action="store_true", help="Log changes without applying them")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
