"""Sync Notion LP管理DBs → Supabase article_lps / client_codes.

Notion DBs synced:
  1. 記事LP管理             → article_lps
  2. クライアント発行コード管理 → client_codes

Notion側は人が管理する最小限の情報のみ:
  - 記事LP: LP名, 案件, Beyond チーム, ページURL, 概要, 使用可否
  - クライアント発行コード: コード名, 案件, URL

Supabase側で自動処理:
  - Beyond URLからページUID自動抽出 (beyond_page_id)
"""

import os
import logging
import requests
from urllib.parse import urlparse
from dotenv import load_dotenv

from database import get_client, get_project_id_by_notion_page

load_dotenv()

logger = logging.getLogger(__name__)

# Notion Database IDs
NOTION_DB_ARTICLE_LP = "d24043bdd84947e2bd3d335d3e2631dd"          # 記事LP管理
NOTION_DB_CLIENT_CODE = "6f858679bb9f4ed28fd38d60973db926"          # クライアント発行コード管理


def _notion_headers() -> dict:
    token = os.getenv("NOTION_API_TOKEN")
    if not token:
        raise ValueError("NOTION_API_TOKEN is required")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def _query_all_pages(database_id: str) -> list[dict]:
    """Fetch all pages from a Notion database (handles pagination)."""
    headers = _notion_headers()
    pages = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor

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


def _get_url(props: dict, name: str) -> str:
    return props.get(name, {}).get("url") or ""


def _get_relation_ids(props: dict, name: str) -> list[str]:
    prop = props.get(name, {})
    return [r["id"] for r in prop.get("relation", [])]


def _extract_beyond_page_id(page_url: str) -> str | None:
    """Extract Beyond page UID from URL.

    Example: https://sb.2023nolimit.com/lowc-m2-01q-bonfk00
           → lowc-m2-01q-bonfk00
    """
    if not page_url:
        return None
    parsed = urlparse(page_url)
    path = parsed.path.strip("/")
    return path if path else None


# ---- Sync functions ----

def sync_article_lps(supabase_client) -> int:
    """Sync 記事LP管理 → article_lps."""
    logger.info("=== Syncing 記事LP管理 → article_lps ===")
    pages = _query_all_pages(NOTION_DB_ARTICLE_LP)
    logger.info(f"  Found {len(pages)} pages in Notion")

    status_map = {"使用中": "active", "使用可": "available", "停止中": "stopped", "テスト": "test"}

    rows = []
    skipped = 0
    for page in pages:
        props = page["properties"]
        lp_name = _get_title(props, "LP名")

        project_notion_ids = _get_relation_ids(props, "案件")
        if not project_notion_ids:
            logger.warning(f"  Skipping '{lp_name}': no project relation")
            skipped += 1
            continue

        project_id = get_project_id_by_notion_page(supabase_client, project_notion_ids[0])
        if not project_id:
            logger.warning(f"  Skipping '{lp_name}': project not found in Supabase")
            skipped += 1
            continue

        page_url = _get_url(props, "ページURL")
        if not page_url:
            logger.warning(f"  Skipping '{lp_name}': no page URL")
            skipped += 1
            continue

        beyond_page_id = _extract_beyond_page_id(page_url)
        beyond_team = _get_select(props, "Beyond チーム") or None
        description = _get_text(props, "概要") or None
        notion_status = _get_select(props, "使用可否")
        status = status_map.get(notion_status, "active")

        rows.append({
            "notion_page_id": page["id"],
            "project_id": project_id,
            "base_url": page_url,
            "lp_name": lp_name,
            "description": description,
            "beyond_page_id": beyond_page_id,
            "beyond_team": beyond_team,
            "status": status,
            "is_active": True,
        })

    if rows:
        result = supabase_client.table("article_lps").upsert(
            rows, on_conflict="notion_page_id"
        ).execute()
        logger.info(f"  Upserted {len(result.data)} article LP rows")
    else:
        logger.info("  No rows to upsert")

    if skipped:
        logger.info(f"  Skipped {skipped} pages")

    return len(rows)


def sync_client_codes(supabase_client) -> int:
    """Sync クライアント発行コード管理 → client_codes."""
    logger.info("=== Syncing クライアント発行コード管理 → client_codes ===")
    pages = _query_all_pages(NOTION_DB_CLIENT_CODE)
    logger.info(f"  Found {len(pages)} pages in Notion")

    rows = []
    skipped = 0
    for page in pages:
        props = page["properties"]
        code_name = _get_title(props, "コード名")

        project_notion_ids = _get_relation_ids(props, "案件")
        if not project_notion_ids:
            logger.warning(f"  Skipping '{code_name}': no project relation")
            skipped += 1
            continue

        project_id = get_project_id_by_notion_page(supabase_client, project_notion_ids[0])
        if not project_id:
            logger.warning(f"  Skipping '{code_name}': project not found in Supabase")
            skipped += 1
            continue

        url = _get_url(props, "URL")
        if not url:
            logger.warning(f"  Skipping '{code_name}': no URL")
            skipped += 1
            continue

        rows.append({
            "notion_page_id": page["id"],
            "project_id": project_id,
            "base_url": url,
            "code_name": code_name,
            "is_active": True,
        })

    if rows:
        result = supabase_client.table("client_codes").upsert(
            rows, on_conflict="notion_page_id"
        ).execute()
        logger.info(f"  Upserted {len(result.data)} client code rows")
    else:
        logger.info("  No rows to upsert")

    if skipped:
        logger.info(f"  Skipped {skipped} pages")

    return len(rows)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    supabase = get_client()

    article_count = sync_article_lps(supabase)
    client_count = sync_client_codes(supabase)

    logger.info(f"\n=== LP sync complete: {article_count} article LPs, {client_count} client codes ===")


if __name__ == "__main__":
    main()
