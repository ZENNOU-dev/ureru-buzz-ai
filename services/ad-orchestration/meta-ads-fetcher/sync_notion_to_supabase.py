"""Sync all Notion databases to Supabase.

Notion DBs synced:
  1. 取引先DB       → clients
  2. 案件DB         → projects
  3. Meta広告アカウント管理 → ad_accounts
  4. Creative Database     → creatives

Sync order: clients → projects → ad_accounts → creatives
(外部キーの依存関係順)
"""

import os
import logging
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

from database import (
    get_client,
    upsert_clients,
    upsert_projects,
    upsert_accounts,
    upsert_creatives,
    upsert_conversion_events,
    get_client_id_by_notion_page,
    get_project_id_by_notion_page,
)

# Notion select value → Meta API action_type mapping
CV_EVENT_MAP = {
    "購入(purchase)": "offsite_conversion.fb_pixel_purchase",
    "リード(lead)": "offsite_conversion.fb_pixel_lead",
    "登録完了(registration)": "offsite_conversion.fb_pixel_complete_registration",
    "コンテンツビュー(content_view)": "offsite_conversion.fb_pixel_view_content",
}

CV_DISPLAY_MAP = {
    "購入(purchase)": "購入",
    "リード(lead)": "リード",
    "登録完了(registration)": "登録完了",
    "コンテンツビュー(content_view)": "コンテンツビュー",
}

load_dotenv()

logger = logging.getLogger(__name__)

# Notion Database IDs
NOTION_DB_CLIENTS = "3264996376a280ef89e6e2d95e6dd5e8"     # 取引先DB
NOTION_DB_PROJECTS = "3264996376a28039979ee97dc86b17fa"     # 案件DB
NOTION_DB_AD_ACCOUNTS = "f7ac4b37db754b78996d426e188393bb"  # Meta広告アカウント管理
NOTION_DB_CREATIVES = "360608fc98f545ab9cd2d586b130e1b0"    # Creative Database


def _notion_headers() -> dict:
    token = os.getenv("NOTION_API_TOKEN")
    if not token:
        raise ValueError("NOTION_API_TOKEN is required. Set it in .env file.")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def _query_all_pages(database_id: str, since: str = None) -> list[dict]:
    """Fetch pages from a Notion database (handles pagination).

    Args:
        database_id: Notion database ID
        since: ISO-8601 datetime string. If provided, only return pages
               edited after this time (incremental sync).
    """
    headers = _notion_headers()
    pages = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor
        if since:
            body["filter"] = {
                "timestamp": "last_edited_time",
                "last_edited_time": {"after": since},
            }

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

        for page in data.get("results", []):
            if not page.get("in_trash"):
                pages.append(page)

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return pages


# ---- Property extractors ----

def _get_title(props: dict, name: str) -> str:
    prop = props.get(name, {})
    items = prop.get("title", [])
    return items[0].get("plain_text", "") if items else ""


def _get_text(props: dict, name: str) -> str:
    prop = props.get(name, {})
    if prop.get("type") == "title":
        return _get_title(props, name)
    items = prop.get("rich_text", [])
    return items[0].get("plain_text", "") if items else ""


def _get_select(props: dict, name: str) -> str:
    prop = props.get(name, {})
    sel = prop.get("select")
    return sel.get("name", "") if sel else ""


def _get_status(props: dict, name: str) -> str:
    prop = props.get(name, {})
    status = prop.get("status")
    return status.get("name", "") if status else ""


def _get_checkbox(props: dict, name: str) -> bool:
    return props.get(name, {}).get("checkbox", False)


def _get_url(props: dict, name: str) -> str:
    return props.get(name, {}).get("url") or ""


def _get_relation_ids(props: dict, name: str) -> list[str]:
    """Get list of Notion page IDs from a relation property."""
    prop = props.get(name, {})
    return [r["id"] for r in prop.get("relation", [])]


def _get_people_names(props: dict, name: str) -> list[str]:
    """Get list of user names from a People property.

    Names are extracted as family name only (split on / or space, take first part).
    e.g. "羽田悠馬/BONNOU" → "羽田"
    """
    prop = props.get(name, {})
    names = []
    for p in prop.get("people", []):
        full = p.get("name", "")
        if not full:
            continue
        # "羽田悠馬/BONNOU" → "羽田悠馬" → "羽田"
        base = full.split("/")[0].strip()
        # Japanese family name = first 2-3 chars before given name
        # Heuristic: if base has 3+ chars and no space, take first 2 (common surname length)
        # If has space, split on space
        if " " in base:
            names.append(base.split(" ")[0])
        elif len(base) >= 3:
            # Most Japanese surnames are 2 chars
            names.append(base[:2])
        else:
            names.append(base)
    return names


# ---- Sync functions ----

def sync_clients(supabase_client):
    """Sync 取引先DB → clients."""
    logger.info("=== Syncing 取引先DB → clients ===")
    pages = _query_all_pages(NOTION_DB_CLIENTS)
    logger.info(f"  Found {len(pages)} pages in Notion")

    rows = []
    for page in pages:
        props = page["properties"]
        rows.append({
            "notion_page_id": page["id"],
            "company_name": _get_title(props, "会社名"),
            "industry": _get_select(props, "業種"),
            "status": _get_status(props, "取引先ステータス"),
        })

    count = upsert_clients(supabase_client, rows)
    logger.info(f"  Upserted {count} clients to Supabase")
    return rows


def sync_projects(supabase_client):
    """Sync 案件DB → projects."""
    logger.info("=== Syncing 案件DB → projects ===")
    pages = _query_all_pages(NOTION_DB_PROJECTS)
    logger.info(f"  Found {len(pages)} pages in Notion")

    rows = []
    for page in pages:
        props = page["properties"]

        # Resolve 取引先DB relation → client_id
        client_id = None
        relation_ids = _get_relation_ids(props, "取引先DB")
        if relation_ids:
            client_id = get_client_id_by_notion_page(supabase_client, relation_ids[0])

        row = {
            "notion_page_id": page["id"],
            "name": _get_title(props, "名前"),
            "genre": _get_select(props, "ジャンル"),
            "industry": _get_select(props, "業種"),
            "status": _get_status(props, "稼働状況"),
        }
        if client_id:
            row["client_id"] = client_id
        rows.append(row)

    count = upsert_projects(supabase_client, rows)
    logger.info(f"  Upserted {count} projects to Supabase")
    return rows


def sync_ad_accounts(supabase_client):
    """Sync Meta広告アカウント管理 → ad_accounts."""
    logger.info("=== Syncing Meta広告アカウント管理 → ad_accounts ===")
    pages = _query_all_pages(NOTION_DB_AD_ACCOUNTS)
    logger.info(f"  Found {len(pages)} pages in Notion")

    rows = []
    conversion_events = []
    for page in pages:
        props = page["properties"]

        # Resolve 案件名 relation → project_id
        project_id = None
        relation_ids = _get_relation_ids(props, "案件名")
        if relation_ids:
            project_id = get_project_id_by_notion_page(supabase_client, relation_ids[0])

        account_id = _get_text(props, "アカウントID")
        if not account_id:
            continue

        # Resolve 運用担当 People → operator_name
        operator_names = _get_people_names(props, "運用担当")
        operator_name = operator_names[0] if operator_names else None

        row = {
            "account_id": account_id,
            "account_name": _get_text(props, "アカウント名"),
            "notion_page_id": page["id"],
            "business_manager_id": _get_text(props, "ビジマネID"),
            "status": _get_select(props, "ステータス"),
            "timezone": _get_text(props, "タイムゾーン") or "Asia/Tokyo",
            "is_target": _get_checkbox(props, "データ取得対象"),
            "has_mcv": _get_checkbox(props, "MCV有無"),
        }
        if project_id:
            row["project_id"] = project_id
        if operator_name:
            row["operator_name"] = operator_name
        rows.append(row)

        # Collect CV/MCV event config
        cv_event = _get_select(props, "CVイベント")
        mcv_event = _get_select(props, "MCVイベント")

        if cv_event and cv_event in CV_EVENT_MAP:
            conversion_events.append({
                "account_id": account_id,
                "event_role": "cv",
                "meta_action_type": CV_EVENT_MAP[cv_event],
                "display_name": CV_DISPLAY_MAP[cv_event],
            })
        if mcv_event and mcv_event in CV_EVENT_MAP:
            conversion_events.append({
                "account_id": account_id,
                "event_role": "mcv",
                "meta_action_type": CV_EVENT_MAP[mcv_event],
                "display_name": CV_DISPLAY_MAP[mcv_event],
            })

    count = upsert_accounts(supabase_client, rows)
    logger.info(f"  Upserted {count} accounts to Supabase")

    # Sync conversion events
    if conversion_events:
        ce_count = upsert_conversion_events(supabase_client, conversion_events)
        logger.info(f"  Upserted {ce_count} conversion event configs")

    target_count = sum(1 for r in rows if r.get("is_target"))
    logger.info(f"  Target accounts (データ取得対象): {target_count}")
    for r in rows:
        if r.get("is_target"):
            logger.info(f"    ✓ {r['account_id']} | {r['account_name']}")

    return rows


def sync_creatives(supabase_client):
    """Sync Creative Database → creatives.

    Schema (updated):
      CR名: title (page name)
      案件DB: relation → 案件DB
      業種: rollup (auto from 案件DB)
      CR URL: url
      担当者: text
    """
    logger.info("=== Syncing Creative Database → creatives ===")
    pages = _query_all_pages(NOTION_DB_CREATIVES)
    logger.info(f"  Found {len(pages)} pages in Notion")

    rows = []
    for page in pages:
        props = page["properties"]

        # CR名 is now the title property
        creative_name = _get_title(props, "CR名")
        if not creative_name:
            continue

        # 案件DB is a relation → resolve to project_id
        project_id = None
        relation_ids = _get_relation_ids(props, "案件DB")
        if relation_ids:
            project_id = get_project_id_by_notion_page(supabase_client, relation_ids[0])

        row = {
            "notion_page_id": page["id"],
            "creative_name": creative_name,
            "cr_url": _get_url(props, "CR URL"),
            "person_in_charge": _get_text(props, "担当者"),
        }
        if project_id:
            row["project_id"] = project_id
        rows.append(row)

    count = upsert_creatives(supabase_client, rows)
    logger.info(f"  Upserted {count} creatives to Supabase")
    return rows


def update_account_statuses(supabase_client):
    """Update Notion account statuses based on delivery data in Supabase.

    Rules:
      - 前日に配信あり (spend > 0) → 配信中
      - 最終配信から1〜7日 → 一時停止
      - 最終配信から7日超 or 配信なし → 停止
    """
    from datetime import date, timedelta

    logger.info("=== Updating account statuses (Supabase → Notion) ===")
    today = date.today()
    yesterday = today - timedelta(days=1)

    # Get last delivery date per account from Supabase via ad_daily_conversions view
    result = (supabase_client.table("ad_daily_conversions")
              .select("account_id, date")
              .gt("spend", 0)
              .order("date", desc=True)
              .execute())

    # Build account → last delivery date map
    last_delivery = {}
    for row in result.data:
        aid = row["account_id"]
        if aid not in last_delivery:
            last_delivery[aid] = row["date"]

    # Get Notion pages for ad accounts
    pages = _query_all_pages(NOTION_DB_AD_ACCOUNTS)
    headers = _notion_headers()
    updated = 0

    for page in pages:
        props = page["properties"]
        account_id = _get_text(props, "アカウントID")
        if not account_id:
            continue

        current_status = _get_select(props, "ステータス")
        last_date_str = last_delivery.get(account_id)

        if last_date_str:
            last_date = date.fromisoformat(last_date_str)
            days_since = (today - last_date).days

            if days_since <= 1:  # Yesterday or today
                new_status = "配信中"
            elif days_since <= 7:
                new_status = "一時停止"
            else:
                new_status = "停止"
        else:
            new_status = "停止"

        if new_status != current_status:
            # Update Notion page
            resp = requests.patch(
                f"https://api.notion.com/v1/pages/{page['id']}",
                headers=headers,
                json={
                    "properties": {
                        "ステータス": {"select": {"name": new_status}},
                    }
                },
            )
            resp.raise_for_status()
            updated += 1
            logger.info(f"  {account_id} | {_get_text(props, 'アカウント名')}: {current_status} → {new_status}")

    logger.info(f"  Updated {updated} account statuses in Notion")


_last_sync_time: str = None


def sync_all(incremental: bool = False):
    """Sync all Notion databases to Supabase in dependency order.

    Args:
        incremental: If True, only sync pages edited since last sync.
    """
    global _last_sync_time

    since = _last_sync_time if incremental else None
    mode = f"incremental (since {since})" if since else "full"
    logger.info(f"Starting {mode} Notion → Supabase sync...")

    supabase = get_client()

    # Sync in FK dependency order (Notion → Supabase)
    sync_clients(supabase)
    sync_projects(supabase)
    sync_ad_accounts(supabase)
    sync_creatives(supabase)

    # Reverse sync: update Notion statuses from Supabase delivery data
    update_account_statuses(supabase)

    # Update last sync time
    _last_sync_time = datetime.now(timezone.utc).isoformat()
    logger.info(f"Sync complete! Next incremental sync after: {_last_sync_time}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )
    sync_all()
