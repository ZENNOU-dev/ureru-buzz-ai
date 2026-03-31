"""Update CR URLs in sheets_data.json and Notion Creative Database.

Reads the full Google Sheets 【制作DB】 F:G columns to build a CR名→URL mapping,
then updates entries with empty CR URLs where a valid https:// URL is available.
"""

import json
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

NOTION_API_TOKEN = os.getenv("NOTION_API_TOKEN")
NOTION_DB_CREATIVES = "360608fc98f545ab9cd2d586b130e1b0"
SHEETS_DATA_PATH = os.path.join(os.path.dirname(__file__), "sheets_data.json")
MAPPING_PATH = "/tmp/cr_url_mapping_complete.json"


def load_mapping():
    """Load the CR name -> URL mapping built from Google Sheets."""
    if not os.path.exists(MAPPING_PATH):
        print("ERROR: Mapping file not found. Run the sheet reading step first.")
        return {}
    with open(MAPPING_PATH) as f:
        mapping = json.load(f)
    # Filter to only https:// URLs (skip filenames like *.mp4)
    valid = {k: v for k, v in mapping.items() if v.startswith("https://")}
    print(f"Loaded mapping: {len(valid)} CR names with valid https:// URLs")
    return valid


def update_sheets_data(mapping):
    """Update sheets_data.json entries with empty CR URLs."""
    with open(SHEETS_DATA_PATH) as f:
        data = json.load(f)

    updated = 0
    skipped_no_mapping = 0
    skipped_filename = 0
    already_has_url = 0

    for i, row in enumerate(data):
        cr_name = row[5] if len(row) > 5 else ""
        if not cr_name:
            continue

        # Check if URL field is present and non-empty
        has_url = len(row) >= 7 and row[6] and row[6].startswith("https://")
        is_empty = len(row) < 7 or row[6] == ""

        if has_url:
            already_has_url += 1
            continue

        if not is_empty:
            continue

        if cr_name in mapping:
            url = mapping[cr_name]
            if len(row) < 7:
                # Extend row to include URL field
                while len(row) < 6:
                    row.append("")
                row.append(url)
            else:
                row[6] = url
            updated += 1
        else:
            skipped_no_mapping += 1

    print(f"\n--- sheets_data.json Results ---")
    print(f"Total rows: {len(data)}")
    print(f"Already have URL: {already_has_url}")
    print(f"Updated with new URL: {updated}")
    print(f"No mapping found (skipped): {skipped_no_mapping}")

    if updated > 0:
        with open(SHEETS_DATA_PATH, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Saved {updated} updates to sheets_data.json")
    else:
        print("No updates needed for sheets_data.json")

    return updated


def notion_headers():
    return {
        "Authorization": f"Bearer {NOTION_API_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def query_notion_empty_cr_urls():
    """Query Notion Creative DB for pages with empty CR URL."""
    headers = notion_headers()
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_CREATIVES}/query"
    payload = {
        "filter": {
            "property": "CR URL",
            "url": {"is_empty": True},
        },
        "page_size": 100,
    }

    all_pages = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            payload["start_cursor"] = start_cursor

        resp = requests.post(url, headers=headers, json=payload)
        time.sleep(0.35)

        if resp.status_code != 200:
            print(f"Error querying Notion: {resp.status_code} {resp.text[:200]}")
            break

        result = resp.json()
        pages = result.get("results", [])
        all_pages.extend(pages)
        has_more = result.get("has_more", False)
        start_cursor = result.get("next_cursor")

    print(f"Found {len(all_pages)} Notion pages with empty CR URL")
    return all_pages


def update_notion_pages(pages, mapping):
    """Update Notion pages with CR URLs from the mapping."""
    headers = notion_headers()
    updated = 0
    skipped = 0
    errors = 0

    for page in pages:
        # Extract CR名 from page properties
        props = page.get("properties", {})
        cr_name_prop = props.get("CR名", {})

        # CR名 could be title or rich_text
        cr_name = ""
        if cr_name_prop.get("type") == "title":
            titles = cr_name_prop.get("title", [])
            if titles:
                cr_name = titles[0].get("plain_text", "")
        elif cr_name_prop.get("type") == "rich_text":
            texts = cr_name_prop.get("rich_text", [])
            if texts:
                cr_name = texts[0].get("plain_text", "")

        if not cr_name:
            skipped += 1
            continue

        if cr_name not in mapping:
            skipped += 1
            continue

        url = mapping[cr_name]
        page_id = page["id"]

        patch_url = f"https://api.notion.com/v1/pages/{page_id}"
        patch_data = {
            "properties": {
                "CR URL": {"url": url}
            }
        }

        resp = requests.patch(patch_url, headers=headers, json=patch_data)
        time.sleep(0.35)

        if resp.status_code == 200:
            updated += 1
            if updated % 10 == 0:
                print(f"  Updated {updated} pages...")
        else:
            errors += 1
            print(f"  Error updating page {page_id}: {resp.status_code} {resp.text[:100]}")

    print(f"\n--- Notion Results ---")
    print(f"Total pages with empty CR URL: {len(pages)}")
    print(f"Updated: {updated}")
    print(f"Skipped (no mapping): {skipped}")
    print(f"Errors: {errors}")

    return updated


def main():
    print("=" * 60)
    print("CR URL Update Script")
    print("=" * 60)

    # Step 1: Load mapping
    mapping = load_mapping()
    if not mapping:
        print("No valid mapping available. Exiting.")
        return

    # Step 2: Update sheets_data.json
    sheets_updated = update_sheets_data(mapping)

    # Step 3: Update Notion
    print(f"\n{'=' * 60}")
    print("Querying Notion for pages with empty CR URL...")
    pages = query_notion_empty_cr_urls()

    if pages:
        notion_updated = update_notion_pages(pages, mapping)
    else:
        notion_updated = 0
        print("No Notion pages to update.")

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"sheets_data.json updated: {sheets_updated}")
    print(f"Notion pages updated: {notion_updated}")


if __name__ == "__main__":
    main()
