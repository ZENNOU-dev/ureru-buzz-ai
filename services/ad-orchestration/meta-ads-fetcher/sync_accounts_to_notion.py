"""Fetch Meta Ad Accounts and sync them to Notion database."""

import os
import json
import requests
from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.user import User

load_dotenv()

# Notion database ID (Meta広告アカウント管理)
NOTION_DATABASE_ID = "f7ac4b37db754b78996d426e188393bb"
NOTION_API_URL = "https://api.notion.com/v1"


def get_notion_headers():
    token = os.getenv("NOTION_API_TOKEN")
    if not token:
        raise ValueError("NOTION_API_TOKEN is required. Set it in .env file.")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }


def fetch_meta_accounts() -> list[dict]:
    """Fetch all ad accounts from Meta API."""
    access_token = os.getenv("META_ACCESS_TOKEN")
    app_id = os.getenv("META_APP_ID", "")
    app_secret = os.getenv("META_APP_SECRET", "")

    if not access_token:
        raise ValueError("META_ACCESS_TOKEN is required.")

    FacebookAdsApi.init(app_id, app_secret, access_token)

    me = User(fbid="me")
    accounts = me.get_ad_accounts(fields=[
        "account_id",
        "name",
        "account_status",
        "currency",
        "timezone_name",
        "business_name",
        "amount_spent",
    ])

    result = []
    for acc in accounts:
        status_map = {1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED", 7: "PENDING"}
        result.append({
            "account_id": f"act_{acc.get('account_id', '')}",
            "name": acc.get("name", ""),
            "status": status_map.get(acc.get("account_status"), "ACTIVE"),
            "currency": acc.get("currency", "JPY"),
            "timezone": acc.get("timezone_name", ""),
            "business_name": acc.get("business_name", ""),
            "amount_spent": float(acc.get("amount_spent", 0)) / 100,  # cents to currency
        })
    return result


def get_existing_accounts() -> dict[str, str]:
    """Get existing accounts from Notion DB. Returns {account_id: page_id}."""
    headers = get_notion_headers()
    url = f"{NOTION_API_URL}/databases/{NOTION_DATABASE_ID}/query"

    existing = {}
    has_more = True
    start_cursor = None

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor

        resp = requests.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

        for page in data.get("results", []):
            props = page.get("properties", {})
            account_id_prop = props.get("アカウントID", {})
            rich_text = account_id_prop.get("rich_text", [])
            if rich_text:
                account_id = rich_text[0].get("plain_text", "")
                existing[account_id] = page["id"]

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return existing


def create_notion_page(account: dict):
    """Create a new page in the Notion accounts database."""
    headers = get_notion_headers()
    url = f"{NOTION_API_URL}/pages"

    # Build currency select - only use values defined in the DB
    currency = account["currency"] if account["currency"] in ("JPY", "USD") else None

    properties = {
        "アカウント名": {
            "title": [{"text": {"content": account["name"]}}]
        },
        "アカウントID": {
            "rich_text": [{"text": {"content": account["account_id"]}}]
        },
        "ステータス": {
            "select": {"name": account["status"]}
        },
        "タイムゾーン": {
            "rich_text": [{"text": {"content": account["timezone"]}}]
        },
        "ビジネス名": {
            "rich_text": [{"text": {"content": account["business_name"]}}]
        },
        "累計消化金額": {
            "number": account["amount_spent"]
        },
        "データ取得対象": {
            "checkbox": account["status"] == "ACTIVE"
        },
    }

    if currency:
        properties["通貨"] = {"select": {"name": currency}}

    body = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": properties,
    }

    resp = requests.post(url, headers=headers, json=body)
    resp.raise_for_status()
    return resp.json()


def update_notion_page(page_id: str, account: dict):
    """Update an existing page in the Notion accounts database."""
    headers = get_notion_headers()
    url = f"{NOTION_API_URL}/pages/{page_id}"

    currency = account["currency"] if account["currency"] in ("JPY", "USD") else None

    properties = {
        "アカウント名": {
            "title": [{"text": {"content": account["name"]}}]
        },
        "ステータス": {
            "select": {"name": account["status"]}
        },
        "タイムゾーン": {
            "rich_text": [{"text": {"content": account["timezone"]}}]
        },
        "ビジネス名": {
            "rich_text": [{"text": {"content": account["business_name"]}}]
        },
        "累計消化金額": {
            "number": account["amount_spent"]
        },
    }

    if currency:
        properties["通貨"] = {"select": {"name": currency}}

    body = {"properties": properties}

    resp = requests.patch(url, headers=headers, json=body)
    resp.raise_for_status()
    return resp.json()


def sync():
    """Main sync: fetch Meta accounts and upsert to Notion."""
    print("Fetching Meta Ad Accounts...")
    accounts = fetch_meta_accounts()
    print(f"Found {len(accounts)} accounts")

    print("Checking existing Notion entries...")
    existing = get_existing_accounts()
    print(f"Found {len(existing)} existing entries in Notion")

    created = 0
    updated = 0

    for acc in accounts:
        if acc["account_id"] in existing:
            print(f"  Updating: {acc['account_id']} ({acc['name']})")
            update_notion_page(existing[acc["account_id"]], acc)
            updated += 1
        else:
            print(f"  Creating: {acc['account_id']} ({acc['name']})")
            create_notion_page(acc)
            created += 1

    print(f"\nDone! Created: {created}, Updated: {updated}")


if __name__ == "__main__":
    sync()
