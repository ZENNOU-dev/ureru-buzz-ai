"""Sync Notion 入稿設定DB → Supabase submission tables.

Reads submission requests from Notion, resolves references,
and creates ad_submissions + child rows in Supabase.

Flow:
  1. Query 入稿設定DB for pages with ステータス=承認済
  2. Resolve: アカウント→account_id, プリセット→preset, CR→creative
  3. Create ad_submissions + submission_campaigns/adsets/ads in Supabase
  4. Write back submission_id to Notion page
  5. Optionally trigger submission_engine
"""

import os
import json
import logging
import re
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

from database import (
    get_client,
    get_project_id_by_notion_page,
)

# meta_action_type → Meta API custom_event_type mapping
ACTION_TYPE_TO_CUSTOM_EVENT = {
    "offsite_conversion.fb_pixel_purchase": "PURCHASE",
    "offsite_conversion.fb_pixel_lead": "LEAD",
    "offsite_conversion.fb_pixel_complete_registration": "COMPLETE_REGISTRATION",
    "offsite_conversion.fb_pixel_view_content": "VIEW_CONTENT",
}

load_dotenv()

logger = logging.getLogger(__name__)

NOTION_DB_SUBMISSIONS = "f614437a1c59424caa71066cb139e7fe"  # 入稿設定DB


def _notion_headers() -> dict:
    token = os.getenv("NOTION_API_TOKEN")
    if not token:
        raise ValueError("NOTION_API_TOKEN is required")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def _query_pages(database_id: str, status_filter: str = None) -> list[dict]:
    """Fetch pages from Notion DB with optional status filter."""
    headers = _notion_headers()
    pages = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor
        if status_filter:
            body["filter"] = {
                "property": "ステータス",
                "select": {"equals": status_filter},
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
    items = props.get(name, {}).get("title", [])
    return items[0].get("plain_text", "") if items else ""


def _get_text(props: dict, name: str) -> str:
    prop = props.get(name, {})
    if prop.get("type") == "title":
        return _get_title(props, name)
    items = prop.get("rich_text", [])
    return items[0].get("plain_text", "") if items else ""


def _get_select(props: dict, name: str) -> str:
    sel = props.get(name, {}).get("select")
    return sel.get("name", "") if sel else ""


def _get_number(props: dict, name: str) -> float | None:
    return props.get(name, {}).get("number")


def _get_checkbox(props: dict, name: str) -> bool:
    return props.get(name, {}).get("checkbox", False)


def _get_url(props: dict, name: str) -> str:
    return props.get(name, {}).get("url") or ""


def _get_date(props: dict, name: str) -> str | None:
    date_prop = props.get(name, {}).get("date")
    if date_prop:
        return date_prop.get("start")
    return None


def _get_relation_ids(props: dict, name: str) -> list[str]:
    return [r["id"] for r in props.get(name, {}).get("relation", [])]


def _get_people(props: dict, name: str) -> str | None:
    people = props.get(name, {}).get("people", [])
    if people:
        return people[0].get("name") or people[0].get("id")
    return None


# ---- Resolution helpers ----

def resolve_account(supabase, account_select: str) -> dict | None:
    """Resolve account select value → ad_accounts row."""
    if not account_select:
        return None
    result = (supabase.table("ad_accounts")
              .select("account_id, account_name, project_id")
              .eq("account_name", account_select)
              .limit(1)
              .execute())
    return result.data[0] if result.data else None


def resolve_preset(supabase, preset_name: str, project_id: int) -> dict | None:
    """Resolve preset select value → submission_presets row."""
    if not preset_name:
        return None
    result = (supabase.table("submission_presets")
              .select("*")
              .eq("project_id", project_id)
              .eq("preset_name", preset_name)
              .limit(1)
              .execute())
    return result.data[0] if result.data else None


def resolve_creative(supabase, notion_page_id: str) -> dict | None:
    """Resolve creative relation → creatives row."""
    if not notion_page_id:
        return None
    result = (supabase.table("creatives")
              .select("id, creative_name, cr_url")
              .eq("notion_page_id", notion_page_id)
              .limit(1)
              .execute())
    return result.data[0] if result.data else None


def resolve_assets(supabase, account_id: str) -> dict:
    """Get default assets for an account."""
    assets = {}
    for asset_type in ("facebook_page", "pixel"):
        result = (supabase.table("account_assets")
                  .select("id, meta_asset_id, ig_backing_id, asset_name")
                  .eq("account_id", account_id)
                  .eq("asset_type", asset_type)
                  .eq("is_default", True)
                  .limit(1)
                  .execute())
        if result.data:
            assets[asset_type] = result.data[0]
    return assets


def resolve_geo_preset(supabase, preset_id: int) -> dict | None:
    if not preset_id:
        return None
    result = (supabase.table("geo_targeting_presets")
              .select("config")
              .eq("id", preset_id)
              .single()
              .execute())
    if not result.data:
        return None
    config = result.data.get("config")
    if isinstance(config, str):
        config = json.loads(config) if config else {}
    return config


def resolve_link_url(supabase, link_url_id: int) -> dict | None:
    if not link_url_id:
        return None
    result = (supabase.table("link_urls")
              .select("url, name")
              .eq("id", link_url_id)
              .eq("is_active", True)
              .single()
              .execute())
    return result.data if result.data else None


def resolve_cv_event(supabase, account_id: str) -> str | None:
    """Resolve account's default CV event → Meta API custom_event_type.

    Looks up conversion_events table (event_role='cv') and maps
    meta_action_type to custom_event_type (e.g. COMPLETE_REGISTRATION).
    """
    result = (supabase.table("account_conversion_events")
              .select("meta_action_type")
              .eq("account_id", account_id)
              .eq("event_role", "cv")
              .limit(1)
              .execute())
    if result.data:
        action_type = result.data[0]["meta_action_type"]
        return ACTION_TYPE_TO_CUSTOM_EVENT.get(action_type)
    return None


def resolve_placement_preset(supabase, preset_id: int) -> dict | None:
    if not preset_id:
        return None
    result = (supabase.table("placement_presets")
              .select("config, is_advantage_plus")
              .eq("id", preset_id)
              .single()
              .execute())
    if not result.data:
        return None
    config = result.data.get("config")
    if isinstance(config, str):
        config = json.loads(config) if config else {}
    return {"config": config, "is_advantage_plus": result.data.get("is_advantage_plus", False)}


# ---- Build submission rows ----

def build_submission_from_notion(supabase, page: dict) -> dict | None:
    """Convert a Notion page to Supabase submission rows.

    Returns dict with keys: submission, campaign, adset, ads
    """
    props = page["properties"]

    # Required fields
    account_select = _get_select(props, "アカウント")
    account = resolve_account(supabase, account_select)
    if not account:
        logger.warning(f"Account not found: {account_select}")
        return None

    account_id = account["account_id"]
    project_id = account.get("project_id")

    # Resolve preset
    preset_name = _get_select(props, "プリセット")
    preset = resolve_preset(supabase, preset_name, project_id) if preset_name and project_id else None

    # Resolve assets
    assets = resolve_assets(supabase, account_id)
    fb_page = assets.get("facebook_page")
    pixel = assets.get("pixel")

    # Resolve creatives
    creative_ids = _get_relation_ids(props, "CR")
    creatives = []
    for cr_notion_id in creative_ids:
        cr = resolve_creative(supabase, cr_notion_id)
        if cr:
            creatives.append(cr)

    if not creatives:
        logger.warning(f"No creatives found for submission: {_get_title(props, '入稿依頼名')}")
        return None

    # Read user inputs (override preset defaults)
    campaign_name = _get_text(props, "キャンペーン名")
    adset_name = _get_text(props, "広告セット名")
    link_url = _get_url(props, "リンク先URL")
    url_params = _get_text(props, "URLパラメータ")
    daily_budget = _get_number(props, "日予算")
    bid_amount = _get_number(props, "入札金額")
    start_date = _get_date(props, "開始日時")
    is_asc = _get_checkbox(props, "ASC")
    requested_by = _get_people(props, "依頼者")

    # Use preset defaults where user didn't specify
    objective = preset["campaign_objective"] if preset else "OUTCOME_SALES"
    bid_strategy = preset["bid_strategy"] if preset else "LOWEST_COST_WITHOUT_CAP"
    optimization_goal = preset["optimization_goal"] if preset else "OFFSITE_CONVERSIONS"

    # CV event priority: preset → account's conversion_events → fallback PURCHASE
    custom_event_type = preset.get("custom_event_type") if preset else None
    if not custom_event_type:
        custom_event_type = resolve_cv_event(supabase, account_id) or "PURCHASE"
    gender_map = {"all": 0, "male": 1, "female": 2}
    gender = gender_map.get(preset["gender"], 0) if preset else 0
    age_min = preset["age_min"] if preset else 18
    age_max = preset["age_max"] if preset else 65

    # Resolve geo/placement/link_url from preset
    geo_config = None
    placement_config = None
    if preset:
        geo_config = resolve_geo_preset(supabase, preset.get("geo_preset_id"))
        placement_data = resolve_placement_preset(supabase, preset.get("placement_preset_id"))
        if placement_data:
            placement_config = placement_data.get("config", {})
            if placement_data.get("is_advantage_plus"):
                placement_config["is_advantage_plus"] = True

    # Link URL: Notion override → preset default
    if not link_url and preset:
        link_url_data = resolve_link_url(supabase, preset.get("default_link_url_id"))
        if link_url_data:
            link_url = link_url_data["url"]

    # Build submission
    submission = {
        "project_id": project_id,
        "account_id": account_id,
        "preset_id": preset["id"] if preset else None,
        "status": "validated",
        "request_text": _get_title(props, "入稿依頼名"),
        "requested_by": requested_by,
        "facebook_page_asset_id": fb_page["id"] if fb_page else None,
        "pixel_asset_id": pixel["id"] if pixel else None,
    }

    # Build campaign
    campaign = {
        "campaign_name": campaign_name or f"{account_select}_{preset_name or 'default'}",
        "objective": objective,
        "bid_strategy": bid_strategy,
        "daily_budget": daily_budget if not is_asc else None,
        "is_cbo": False,
        "is_asc": is_asc,
        "status": preset.get("campaign_status", "PAUSED") if preset else "PAUSED",
    }

    # Build adset
    adset = {
        "adset_name": adset_name or campaign["campaign_name"],
        "daily_budget": daily_budget,
        "bid_amount": bid_amount,
        "bid_strategy": bid_strategy if bid_amount else None,
        "optimization_goal": optimization_goal,
        "promoted_pixel_id": pixel["meta_asset_id"] if pixel else None,
        "promoted_custom_event": custom_event_type,
        "gender": gender,
        "age_min": age_min,
        "age_max": age_max,
        "geo_locations": geo_config or {"countries": ["JP"]},
        "placement_config": placement_config,
        "status": preset.get("adset_status", "ACTIVE") if preset else "ACTIVE",
        "start_time": start_date,
    }

    # Build ads (one per creative)
    ads = []
    for cr in creatives:
        ad = {
            "ad_name": f"{adset['adset_name']}/{cr['creative_name']}",
            "creative_id": cr["id"],
            "creative_type": "VIDEO",
            "title": preset.get("default_title", "") if preset else "",
            "body": preset.get("default_body", "") if preset else "",
            "description": preset.get("default_description", "") if preset else "",
            "drive_url": cr.get("cr_url", ""),
            "link_url": link_url,
            "url_parameters": url_params,
            "page_id": fb_page["meta_asset_id"] if fb_page else None,
            "instagram_actor_id": fb_page.get("ig_backing_id") if fb_page else None,
            "status": preset.get("ad_status", "ACTIVE") if preset else "ACTIVE",
        }
        ads.append(ad)

    return {
        "notion_page_id": page["id"],
        "submission": submission,
        "campaign": campaign,
        "adset": adset,
        "ads": ads,
    }


# ---- Write to Supabase ----

def create_submission_in_supabase(supabase, data: dict) -> int:
    """Insert submission + campaigns + adsets + ads into Supabase.

    Returns submission_id.
    """
    # Insert ad_submissions
    sub_result = (supabase.table("ad_submissions")
                  .insert(data["submission"])
                  .execute())
    submission_id = sub_result.data[0]["id"]

    # Insert campaign
    camp_data = {**data["campaign"], "submission_id": submission_id}
    camp_result = (supabase.table("submission_campaigns")
                   .insert(camp_data)
                   .execute())
    campaign_id = camp_result.data[0]["id"]

    # Insert adset
    adset_data = {**data["adset"], "campaign_id": campaign_id}
    # Convert dict fields to JSON strings for JSONB columns
    for key in ("geo_locations", "placement_config", "include_custom_audiences", "exclude_custom_audiences"):
        if key in adset_data and isinstance(adset_data[key], dict):
            adset_data[key] = json.dumps(adset_data[key])
        elif key in adset_data and isinstance(adset_data[key], list):
            adset_data[key] = json.dumps(adset_data[key])
    adset_result = (supabase.table("submission_adsets")
                    .insert(adset_data)
                    .execute())
    adset_id = adset_result.data[0]["id"]

    # Insert ads
    for ad in data["ads"]:
        ad_data = {**ad, "adset_id": adset_id}
        supabase.table("submission_ads").insert(ad_data).execute()

    logger.info(f"Created submission {submission_id}: 1 campaign, 1 adset, {len(data['ads'])} ads")
    return submission_id


# ---- Update Notion ----

def update_notion_page(page_id: str, submission_id: int, status: str = None, error: str = None):
    """Write submission_id and status back to Notion page."""
    headers = _notion_headers()
    properties = {
        "submission_id": {"number": submission_id},
    }
    if status:
        properties["ステータス"] = {"select": {"name": status}}
    if error:
        properties["エラー詳細"] = {
            "rich_text": [{"text": {"content": error[:2000]}}]
        }

    resp = requests.patch(
        f"https://api.notion.com/v1/pages/{page_id}",
        headers=headers,
        json={"properties": properties},
    )
    resp.raise_for_status()


# ---- Main sync ----

def sync_approved_submissions(auto_submit: bool = False):
    """Sync approved Notion submissions to Supabase.

    Args:
        auto_submit: If True, also trigger submission_engine after creating rows.
    """
    supabase = get_client()

    # 1. Get approved pages
    pages = _query_pages(NOTION_DB_SUBMISSIONS, status_filter="承認済")
    logger.info(f"Found {len(pages)} approved submissions in Notion")

    if not pages:
        return []

    results = []

    for page in pages:
        props = page["properties"]
        title = _get_title(props, "入稿依頼名")

        # Skip if already has submission_id
        existing_id = _get_number(props, "submission_id")
        if existing_id:
            logger.info(f"Skip '{title}': already has submission_id={int(existing_id)}")
            continue

        logger.info(f"Processing: {title}")

        try:
            # 2. Build submission data
            data = build_submission_from_notion(supabase, page)
            if not data:
                update_notion_page(page["id"], 0, status="エラー",
                                   error="Failed to resolve account/creatives")
                continue

            # 3. Write to Supabase
            submission_id = create_submission_in_supabase(supabase, data)

            # 4. Update Notion with submission_id
            update_notion_page(page["id"], submission_id, status="入稿中")

            results.append({
                "title": title,
                "submission_id": submission_id,
                "ads_count": len(data["ads"]),
            })

            # 5. Optionally trigger submission engine
            if auto_submit:
                from submission_engine import submit
                try:
                    submit(submission_id)
                    update_notion_page(page["id"], submission_id, status="完了")
                except Exception as e:
                    logger.error(f"Submission engine failed: {e}")
                    update_notion_page(page["id"], submission_id, status="エラー",
                                       error=str(e)[:2000])

        except Exception as e:
            logger.error(f"Failed to process '{title}': {e}")
            update_notion_page(page["id"], 0, status="エラー", error=str(e)[:2000])

    logger.info(f"Sync complete: {len(results)} submissions created")
    return results


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    parser = argparse.ArgumentParser(description="Sync Notion 入稿設定DB → Supabase")
    parser.add_argument("--auto-submit", action="store_true",
                        help="Also trigger Meta API submission after syncing")
    args = parser.parse_args()

    results = sync_approved_submissions(auto_submit=args.auto_submit)
    for r in results:
        print(f"  ✓ {r['title']} → submission_id={r['submission_id']} ({r['ads_count']} ads)")
