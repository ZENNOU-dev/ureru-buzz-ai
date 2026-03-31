"""Meta Ads API data fetcher."""

import os
import re
import logging
from datetime import datetime, timedelta, timezone

import requests
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.adsinsights import AdsInsights

from database import (
    get_client,
    get_target_accounts,
    get_target_account_ids,
    upsert_ad_data,
    resolve_creative_ids,
    get_cats_redirect_url_map,
    log_fetch,
)

logger = logging.getLogger(__name__)

# Meta API fields corresponding to spreadsheet columns
INSIGHT_FIELDS = [
    AdsInsights.Field.account_name,       # アカウント名
    AdsInsights.Field.account_id,         # アカウントID
    AdsInsights.Field.campaign_name,      # キャンペーン名
    AdsInsights.Field.campaign_id,        # キャンペーンID
    AdsInsights.Field.adset_name,         # 広告セット名
    AdsInsights.Field.adset_id,           # 広告セットID
    AdsInsights.Field.ad_name,            # 広告名
    AdsInsights.Field.ad_id,              # 広告ID
    AdsInsights.Field.spend,              # COST / 消化金額
    AdsInsights.Field.impressions,        # IMP / インプレッション
    AdsInsights.Field.reach,              # リーチ
    AdsInsights.Field.inline_link_clicks, # CLICK / リンクのクリック
    AdsInsights.Field.actions,            # CV / MCV / 登録完了 / リード (action types)
    AdsInsights.Field.video_play_actions,           # 再生数
    AdsInsights.Field.video_p25_watched_actions,    # 25%再生数
    AdsInsights.Field.video_p50_watched_actions,    # 50%再生数
    AdsInsights.Field.video_p75_watched_actions,    # 75%再生数
    AdsInsights.Field.video_p95_watched_actions,    # 95%再生数
    AdsInsights.Field.video_p100_watched_actions,   # 100%再生数
    AdsInsights.Field.video_thruplay_watched_actions,  # ThruPlay (完視 or 15秒)
    # 3秒視聴数はactions内のvideo_viewから取得（別途フィールド不要）
]


def extract_action_value(actions: list, action_type: str) -> int:
    """Extract a specific action value from the actions list."""
    if not actions:
        return 0
    for action in actions:
        if action.get("action_type") == action_type:
            return int(action.get("value", 0))
    return 0


def extract_video_metric(video_actions: list) -> int:
    """Extract video action value (usually first entry with type 'video_view')."""
    if not video_actions:
        return 0
    for action in video_actions:
        return int(action.get("value", 0))
    return 0


def extract_creative_name(ad_name: str) -> str:
    """Extract creative name from ad name.

    Creative name is between the 1st and 2nd slash in the ad name.
    Example: 'something/creative_name/rest' -> 'creative_name'
    """
    if not ad_name:
        return ""
    parts = ad_name.split("/")
    if len(parts) >= 3:
        return parts[1].strip()
    return ad_name


def extract_3s_views(insight: dict) -> int:
    """Extract 3-second video views.

    Meta API: actions内のvideo_view = 管理画面の「動画の3秒再生数」。
    ※ video_thruplay_watched_actions（ThruPlay=完視or15秒）とは別物。
    """
    actions = insight.get("actions")
    if actions:
        return extract_action_value(actions, "video_view")
    return 0


def extract_thruplay_views(insight: dict) -> int:
    """Extract ThruPlay views (completion or 15s, whichever comes first)."""
    thruplay = insight.get("video_thruplay_watched_actions")
    if thruplay:
        return extract_video_metric(thruplay)
    return 0


def parse_all_actions(actions: list) -> dict[str, int]:
    """Parse all action types from the actions list into a dict.

    Returns: {action_type: value} for all actions found.
    This is stored in ad_action_stats (EAV table).
    """
    result = {}
    if not actions:
        return result
    for action in actions:
        action_type = action.get("action_type", "")
        value = int(action.get("value", 0))
        if action_type and value > 0:
            result[action_type] = value
    return result


def fetch_insights_for_account(account_id: str, date_start: str, date_stop: str) -> list[dict]:
    """Fetch ad-level insights for a single account."""
    account = AdAccount(account_id)

    params = {
        "time_range": {"since": date_start, "until": date_stop},
        "time_increment": 1,  # Daily breakdown
        "level": "ad",        # Ad-level data (lowest hierarchy)
        "limit": 500,
    }

    logger.info(f"Fetching insights for {account_id} from {date_start} to {date_stop}")
    insights = account.get_insights(fields=INSIGHT_FIELDS, params=params)

    rows = []
    now = datetime.utcnow().isoformat()

    for insight in insights:
        actions = insight.get("actions", [])

        row = {
            "fetched_at": now,
            "date": insight.get("date_start", ""),
            "account_name": insight.get("account_name", ""),
            "account_id": f"act_{insight.get('account_id', '')}",
            "campaign_name": insight.get("campaign_name", ""),
            "campaign_id": insight.get("campaign_id", ""),
            "adset_name": insight.get("adset_name", ""),
            "adset_id": insight.get("adset_id", ""),
            "ad_name": insight.get("ad_name", ""),
            "ad_id": insight.get("ad_id", ""),
            "spend": float(insight.get("spend", 0)),
            "impressions": int(insight.get("impressions", 0)),
            "reach": int(insight.get("reach", 0)),
            "inline_link_clicks": int(insight.get("inline_link_clicks", 0)),
            "video_plays": extract_video_metric(insight.get("video_play_actions")),
            "video_3s_views": extract_3s_views(insight),
            "video_thruplay_views": extract_thruplay_views(insight),
            "video_p25_views": extract_video_metric(insight.get("video_p25_watched_actions")),
            "video_p50_views": extract_video_metric(insight.get("video_p50_watched_actions")),
            "video_p75_views": extract_video_metric(insight.get("video_p75_watched_actions")),
            "video_p95_views": extract_video_metric(insight.get("video_p95_watched_actions")),
            "video_p100_views": extract_video_metric(insight.get("video_p100_watched_actions")),
            # All actions parsed for EAV storage
            "actions_parsed": parse_all_actions(actions),
        }
        rows.append(row)

    logger.info(f"Fetched {len(rows)} rows for {account_id}")
    return rows


def _extract_creative_link(creative_data: dict) -> str | None:
    """Extract destination URL from Meta creative object_story_spec."""
    spec = creative_data.get("object_story_spec", {})
    # video_data path
    video = spec.get("video_data", {})
    cta = video.get("call_to_action", {})
    link = cta.get("value", {}).get("link")
    if link:
        return link
    # link_data path (image/carousel ads)
    link_data = spec.get("link_data", {})
    return link_data.get("link")


def fetch_ad_creative_urls(ad_ids: list[str], access_token: str) -> dict[str, str]:
    """Fetch creative destination URLs for multiple ads via Meta API.

    Returns: {ad_id: link_url}
    """
    result = {}
    # Batch in groups of 50 (Meta API limit)
    for i in range(0, len(ad_ids), 50):
        batch = ad_ids[i:i+50]
        ids_str = ",".join(batch)
        resp = requests.get(
            "https://graph.facebook.com/v19.0/",
            params={
                "ids": ids_str,
                "fields": "creative{object_story_spec}",
                "access_token": access_token,
            }
        )
        if resp.status_code != 200:
            logger.warning(f"Meta API batch failed: {resp.status_code}")
            continue

        data = resp.json()
        for ad_id, ad_data in data.items():
            creative = ad_data.get("creative", {})
            link = _extract_creative_link(creative)
            if link:
                result[ad_id] = link

    return result


def resolve_cats_content_ids_via_api(client, access_token: str) -> int:
    """Resolve ads.cats_content_id by fetching creative URLs from Meta API.

    Flow: Meta API → creative URL → match cats_contents.redirect_url → set FK
    """
    from run_migration_v9 import execute_sql

    # Get unresolved ad_ids
    unresolved = execute_sql(
        "SELECT ad_id FROM ads WHERE cats_content_id IS NULL;"
    )
    if not unresolved:
        return 0

    ad_ids = [r["ad_id"] for r in unresolved]
    logger.info(f"Fetching creative URLs for {len(ad_ids)} unresolved ads")

    # Get URLs from Meta API
    ad_urls = fetch_ad_creative_urls(ad_ids, access_token)
    logger.info(f"Got {len(ad_urls)} creative URLs from Meta API")

    if not ad_urls:
        return 0

    # Match against cats_contents.redirect_url
    cats_url_map = get_cats_redirect_url_map(client)
    matches = {}
    for ad_id, link_url in ad_urls.items():
        if link_url:
            cats_id = cats_url_map.get(link_url)
            if cats_id:
                matches[ad_id] = cats_id
    logger.info(f"Matched {len(matches)} ads to CATS contents")

    if not matches:
        return 0

    # Batch update via SQL (faster than individual updates)
    # Build VALUES list for bulk update
    values = ", ".join(
        f"('{ad_id}', {cats_id})" for ad_id, cats_id in matches.items()
    )
    execute_sql(f"""
        UPDATE ads SET cats_content_id = v.cats_id::int
        FROM (VALUES {values}) AS v(ad_id, cats_id)
        WHERE ads.ad_id = v.ad_id;
    """)

    return len(matches)


def _fetch_bm_account_ids(business_id: str, access_token: str) -> list[str]:
    """Fetch all ACTIVE ad account IDs under a Business Manager."""
    account_ids = []
    url = f"https://graph.facebook.com/v19.0/{business_id}/client_ad_accounts"
    params = {
        "fields": "account_id,account_status",
        "limit": 100,
        "access_token": access_token,
    }

    while url:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        for acc in data.get("data", []):
            if acc.get("account_status") == 1:  # ACTIVE only
                account_ids.append(f"act_{acc['account_id']}")

        next_url = data.get("paging", {}).get("next")
        if next_url:
            url = next_url
            params = {}
        else:
            url = None

    logger.info(f"Found {len(account_ids)} active accounts under BM {business_id}")
    return account_ids


def run_fetch(date_start: str = None, date_stop: str = None):
    """Main fetch function: pull data from all configured accounts and save to DB."""
    # Default to yesterday + today (2-day window to catch late-reported data)
    if date_start is None:
        date_start = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    if date_stop is None:
        date_stop = datetime.now().strftime("%Y-%m-%d")

    # Initialize API
    app_id = os.getenv("META_APP_ID", "")
    app_secret = os.getenv("META_APP_SECRET", "")
    access_token = os.getenv("META_ACCESS_TOKEN")
    business_id = os.getenv("META_BUSINESS_ID")

    if not access_token:
        raise ValueError("META_ACCESS_TOKEN is required. Set it in .env file.")
    if not business_id:
        raise ValueError("META_BUSINESS_ID is required. Set it in .env file.")

    FacebookAdsApi.init(app_id, app_secret, access_token)

    # Supabase client
    client = get_client()

    # Get target accounts from Supabase (synced from Notion) with project_id
    target_accounts = get_target_accounts(client)
    if target_accounts:
        # Build account_id → project_id mapping
        project_map = {a["account_id"]: a.get("project_id") for a in target_accounts}
        account_ids = list(project_map.keys())
    else:
        # Fallback: fetch from Business Manager
        account_ids = _fetch_bm_account_ids(business_id, access_token)
        project_map = {}

    logger.info(f"Fetching data for {len(account_ids)} accounts")

    started_at = datetime.now(timezone.utc).isoformat()
    total_rows = 0

    try:
        for account_id in account_ids:
            if not account_id.startswith("act_"):
                logger.warning(f"Skipping invalid account_id (missing act_ prefix): {account_id}")
                continue
            try:
                rows = fetch_insights_for_account(account_id, date_start, date_stop)
                if rows:
                    upsert_ad_data(client, rows)
                    total_rows += len(rows)
            except Exception as acct_err:
                logger.error(f"Failed to fetch {account_id}: {acct_err}")
                continue

        # Resolve creative_id for newly created ads
        resolved = resolve_creative_ids(client)
        if resolved:
            logger.info(f"Resolved {resolved} creative_id FKs")

        # Resolve cats_content_id via Meta API creative URLs
        cats_resolved = resolve_cats_content_ids_via_api(client, access_token)
        if cats_resolved:
            logger.info(f"Resolved {cats_resolved} cats_content_id FKs via URL matching")

        log_fetch(client, "success", total_rows, started_at=started_at)
        logger.info(f"Fetch complete. Total rows: {total_rows}")

    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        log_fetch(client, "error", total_rows, str(e), started_at=started_at)
        raise

    return total_rows
