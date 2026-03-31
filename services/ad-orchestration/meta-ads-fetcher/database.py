"""Supabase database for storing Meta Ads data."""

import logging
import os
from datetime import datetime, timezone

from supabase import create_client, Client

logger = logging.getLogger(__name__)


def get_client(postgrest_timeout: int = 300) -> Client:
    """Get Supabase client from environment variables.

    Args:
        postgrest_timeout: PostgREST HTTP timeout in seconds (default 300s for large embedding writes).
    """
    from supabase.lib.client_options import SyncClientOptions
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required. Set them in .env file.")
    opts = SyncClientOptions(postgrest_client_timeout=postgrest_timeout)
    return create_client(url, key, options=opts)


def _safe_upsert(client: Client, table: str, rows: list[dict],
                 on_conflict: str, label_key: str = "id") -> int:
    """Upsert with row-level retry on failure.

    First tries batch upsert. If that fails (e.g. FK violation on one row),
    falls back to row-by-row upsert, logging failures individually.
    Returns count of successfully upserted rows.
    """
    if not rows:
        return 0
    try:
        result = client.table(table).upsert(rows, on_conflict=on_conflict).execute()
        return len(result.data)
    except Exception as e:
        logger.warning("Batch upsert to %s failed (%d rows): %s — retrying row-by-row",
                       table, len(rows), e)
        success = 0
        for row in rows:
            try:
                client.table(table).upsert([row], on_conflict=on_conflict).execute()
                success += 1
            except Exception as row_err:
                row_label = row.get(label_key, row.get(on_conflict.split(",")[0], "?"))
                logger.error("  %s upsert failed for %s=%s: %s",
                             table, label_key, row_label, row_err)
        return success


# ---- clients ----

def upsert_clients(client: Client, rows: list[dict]) -> int:
    """Insert or update clients (取引先)."""
    return _safe_upsert(client, "clients", rows, "notion_page_id", "company_name")


def get_client_id_by_notion_page(client: Client, notion_page_id: str) -> int | None:
    """Get Supabase client ID from Notion page ID."""
    result = (client.table("clients")
              .select("id")
              .eq("notion_page_id", notion_page_id)
              .execute())
    return result.data[0]["id"] if result.data else None


# ---- projects ----

def upsert_projects(client: Client, rows: list[dict]) -> int:
    """Insert or update projects (案件)."""
    return _safe_upsert(client, "projects", rows, "notion_page_id", "name")


def get_project_id_by_notion_page(client: Client, notion_page_id: str) -> int | None:
    """Get Supabase project ID from Notion page ID."""
    result = (client.table("projects")
              .select("id")
              .eq("notion_page_id", notion_page_id)
              .execute())
    return result.data[0]["id"] if result.data else None


def get_project_id_by_name(client: Client, name: str) -> int | None:
    """Get Supabase project ID from project name."""
    result = (client.table("projects")
              .select("id")
              .eq("name", name)
              .execute())
    return result.data[0]["id"] if result.data else None


# ---- ad_accounts ----

def upsert_accounts(client: Client, accounts: list[dict]) -> int:
    """Insert or update ad accounts from Notion."""
    return _safe_upsert(client, "ad_accounts", accounts, "account_id", "account_name")


def get_target_account_ids(client: Client) -> list[str]:
    """Get account IDs that are marked as targets."""
    result = client.table("ad_accounts").select("account_id").eq("is_target", True).execute()
    return [row["account_id"] for row in result.data]


def get_target_accounts(client: Client) -> list[dict]:
    """Get full account info for target accounts."""
    result = (client.table("ad_accounts")
              .select("account_id,account_name,project_id")
              .eq("is_target", True)
              .execute())
    return result.data


# ---- account_conversion_events ----

def upsert_conversion_events(client: Client, rows: list[dict]) -> int:
    """Insert or update conversion event configs per account."""
    return _safe_upsert(client, "account_conversion_events", rows, "account_id,event_role", "account_id")


def get_conversion_events(client: Client, account_id: str) -> dict:
    """Get CV/MCV event config for an account.

    Returns dict like: {'cv': 'offsite_conversion.fb_pixel_purchase', 'mcv': 'offsite_conversion.fb_pixel_view_content'}
    mapping event_role → meta_action_type.
    """
    result = (client.table("account_conversion_events")
              .select("event_role,meta_action_type")
              .eq("account_id", account_id)
              .execute())

    mapping = {}
    for row in result.data:
        mapping[row["event_role"]] = row["meta_action_type"]
    return mapping


# ---- campaigns ----

def upsert_campaigns(client: Client, rows: list[dict]) -> int:
    """Insert or update campaigns."""
    return _safe_upsert(client, "campaigns", rows, "campaign_id", "campaign_name")


# ---- adsets ----

def upsert_adsets(client: Client, rows: list[dict]) -> int:
    """Insert or update adsets."""
    return _safe_upsert(client, "adsets", rows, "adset_id", "adset_name")


# ---- ads ----

def upsert_ads(client: Client, rows: list[dict]) -> int:
    """Insert or update ads."""
    return _safe_upsert(client, "ads", rows, "ad_id", "ad_name")


def get_ads_without_creative(client: Client) -> list[dict]:
    """Get ads that don't have creative_id resolved yet."""
    result = (client.table("ads")
              .select("ad_id,ad_name")
              .is_("creative_id", "null")
              .execute())
    return result.data


def update_ad_creative_id(client: Client, ad_id: str, creative_id: int) -> None:
    """Set creative_id FK for an ad."""
    client.table("ads").update({"creative_id": creative_id}).eq("ad_id", ad_id).execute()


# ---- ad_daily_metrics ----

def upsert_ad_daily_metrics(client: Client, rows: list[dict]) -> int:
    """Insert or update daily metrics."""
    return _safe_upsert(client, "ad_daily_metrics", rows, "date,ad_id", "ad_id")


# ---- ad_action_stats ----

def upsert_ad_action_stats(client: Client, rows: list[dict]) -> int:
    """Insert or update action stats (CV/MCV etc)."""
    return _safe_upsert(client, "ad_action_stats", rows, "date,ad_id,action_type", "ad_id")


# ---- creatives ----

def upsert_creatives(client: Client, rows: list[dict]) -> int:
    """Insert or update creatives."""
    return _safe_upsert(client, "creatives", rows, "creative_name", "creative_name")


def get_creative_name_to_id(client: Client) -> dict[str, int]:
    """Get mapping of creative_name → creatives.id for FK resolution."""
    all_creatives = []
    offset = 0
    limit = 1000
    while True:
        result = (client.table("creatives")
                  .select("id,creative_name")
                  .range(offset, offset + limit - 1)
                  .execute())
        if not result.data:
            break
        all_creatives.extend(result.data)
        if len(result.data) < limit:
            break
        offset += limit

    return {row["creative_name"]: row["id"] for row in all_creatives}


# ---- cr_videos / cr_scenes (embedding pipeline) ----

def upsert_cr_video(client: Client, row: dict) -> int:
    """Insert or update a single cr_video row. Returns the video id."""
    result = (client.table("cr_videos")
              .upsert(row, on_conflict="creative_id")
              .execute())
    if result.data:
        return result.data[0]["id"]
    return 0


def upsert_cr_scenes(client: Client, rows: list[dict]) -> int:
    """Insert or update cr_scenes rows."""
    return _safe_upsert(client, "cr_scenes", rows, "video_id,scene_index", "scene_index")


def update_cr_video_fields(client: Client, video_id: int, fields: dict) -> None:
    """Update specific fields on a cr_video row."""
    client.table("cr_videos").update(fields).eq("id", video_id).execute()


def update_cr_scene_fields(client: Client, scene_id: int, fields: dict) -> None:
    """Update specific fields on a cr_scene row."""
    client.table("cr_scenes").update(fields).eq("id", scene_id).execute()


def get_cr_scenes(client: Client, video_id: int) -> list[dict]:
    """Get all scenes for a video, ordered by scene_index."""
    result = (client.table("cr_scenes")
              .select("*")
              .eq("video_id", video_id)
              .order("scene_index")
              .execute())
    return result.data


# ---- dpro_items / dpro_videos / dpro_scenes (competitor CR pipeline) ----

def upsert_dpro_items(client: Client, rows: list[dict]) -> int:
    """Insert or update dpro_items rows."""
    return _safe_upsert(client, "dpro_items", rows, "dpro_item_id", "dpro_item_id")


def get_dpro_item_by_dpro_id(client: Client, dpro_item_id: str) -> dict | None:
    """Get a dpro_item by its DPro API item_id."""
    result = (client.table("dpro_items")
              .select("*")
              .eq("dpro_item_id", str(dpro_item_id))
              .limit(1)
              .execute())
    return result.data[0] if result.data else None


def upsert_dpro_video(client: Client, row: dict) -> int:
    """Insert or update a single dpro_video row. Returns the video id."""
    result = (client.table("dpro_videos")
              .upsert(row, on_conflict="dpro_item_id")
              .execute())
    if result.data:
        return result.data[0]["id"]
    return 0


def upsert_dpro_scenes(client: Client, rows: list[dict]) -> int:
    """Insert or update dpro_scenes rows."""
    return _safe_upsert(client, "dpro_scenes", rows, "video_id,scene_index", "scene_index")


def update_dpro_video_fields(client: Client, video_id: int, fields: dict) -> None:
    """Update specific fields on a dpro_video row."""
    client.table("dpro_videos").update(fields).eq("id", video_id).execute()


def update_dpro_scene_fields(client: Client, scene_id: int, fields: dict) -> None:
    """Update specific fields on a dpro_scene row."""
    client.table("dpro_scenes").update(fields).eq("id", scene_id).execute()


def get_dpro_scenes(client: Client, video_id: int) -> list[dict]:
    """Get all dpro_scenes for a video, ordered by scene_index."""
    result = (client.table("dpro_scenes")
              .select("*")
              .eq("video_id", video_id)
              .order("scene_index")
              .execute())
    return result.data


# ---- combined upsert for fetcher ----

def upsert_ad_data(client: Client, rows: list[dict]) -> int:
    """Upsert a batch of ad data to normalized tables.

    Each row contains campaign/adset/ad info + metrics + actions.
    This function splits and writes to:
      1. campaigns
      2. adsets
      3. ads
      4. ad_daily_metrics
      5. ad_action_stats

    Returns total metrics rows written.
    """
    if not rows:
        return 0

    # Deduplicate dimensions
    campaigns = {}
    adsets = {}
    ads = {}
    metrics = []
    action_stats = []

    for row in rows:
        campaign_id = row["campaign_id"]
        adset_id = row["adset_id"]
        ad_id = row["ad_id"]

        if campaign_id and campaign_id not in campaigns:
            campaigns[campaign_id] = {
                "campaign_id": campaign_id,
                "campaign_name": row["campaign_name"],
                "account_id": row["account_id"],
            }

        if adset_id and adset_id not in adsets:
            adsets[adset_id] = {
                "adset_id": adset_id,
                "adset_name": row["adset_name"],
                "campaign_id": campaign_id,
            }

        if ad_id and ad_id not in ads:
            ads[ad_id] = {
                "ad_id": ad_id,
                "ad_name": row["ad_name"],
                "adset_id": adset_id,
            }

        # Metrics
        metrics.append({
            "date": row["date"],
            "ad_id": ad_id,
            "spend": row["spend"],
            "impressions": row["impressions"],
            "reach": row["reach"],
            "clicks": row["inline_link_clicks"],
            "video_plays": row["video_plays"],
            "video_3s_views": row["video_3s_views"],
            "video_thruplay_views": row.get("video_thruplay_views", 0),
            "video_p25_views": row["video_p25_views"],
            "video_p50_views": row["video_p50_views"],
            "video_p75_views": row["video_p75_views"],
            "video_p95_views": row["video_p95_views"],
            "video_p100_views": row["video_p100_views"],
            "fetched_at": row["fetched_at"],
        })

        # Action stats
        for action_type, value in row.get("actions_parsed", {}).items():
            if value and value > 0:
                action_stats.append({
                    "date": row["date"],
                    "ad_id": ad_id,
                    "action_type": action_type,
                    "value": value,
                })

    # Upsert in FK dependency order
    upsert_campaigns(client, list(campaigns.values()))
    upsert_adsets(client, list(adsets.values()))
    upsert_ads(client, list(ads.values()))
    upsert_ad_daily_metrics(client, metrics)
    if action_stats:
        upsert_ad_action_stats(client, action_stats)

    return len(metrics)


# ---- creative_id resolution ----

def resolve_creative_ids(client: Client) -> int:
    """Resolve creative_id for ads that don't have it yet.

    Parses ad_name to extract creative_name, then looks up in creatives table.
    This is run once per sync cycle to fill in missing FKs.
    """
    unresolved = get_ads_without_creative(client)
    if not unresolved:
        return 0

    creative_map = get_creative_name_to_id(client)
    resolved = 0

    for ad in unresolved:
        ad_name = ad["ad_name"]
        parts = ad_name.split("/")
        if len(parts) >= 3:
            cr_name = parts[1].strip()
        else:
            cr_name = ad_name

        creative_id = creative_map.get(cr_name)
        if creative_id:
            update_ad_creative_id(client, ad["ad_id"], creative_id)
            resolved += 1

    return resolved


# ---- fetch_log ----

def log_fetch(client: Client, status: str, rows_fetched: int = 0,
              error_message: str = None, started_at: str = None):
    """Log a fetch attempt."""
    now = datetime.now(timezone.utc).isoformat()
    client.table("fetch_log").insert({
        "started_at": started_at or now,
        "finished_at": now,
        "status": status,
        "rows_fetched": rows_fetched,
        "error_message": error_message,
    }).execute()


# ---- lp_base_urls ----

def upsert_lp_base_urls(client: Client, rows: list[dict]) -> int:
    """Insert or update lp_base_urls (記事LP/クライアント発行コード)."""
    if not rows:
        return 0
    result = client.table("lp_base_urls").upsert(
        rows, on_conflict="notion_page_id"
    ).execute()
    return len(result.data)


def get_cats_redirect_url_map(client: Client) -> dict[str, int]:
    """Build redirect_url → cats_content_id map for all CATS contents."""
    result = client.table("cats_contents").select("cats_content_id,redirect_url").execute()
    return {r["redirect_url"]: r["cats_content_id"] for r in result.data if r.get("redirect_url")}


def get_cats_name_map(client: Client) -> dict[str, int]:
    """Build CATS content name → cats_content_id map."""
    result = client.table("cats_contents").select("cats_content_id,name").execute()
    return {r["name"]: r["cats_content_id"] for r in result.data if r.get("name")}


def bulk_set_cats_content_ids(client: Client, matches: dict[str, int]) -> int:
    """Batch update ads.cats_content_id from {ad_id: cats_content_id} map."""
    updated = 0
    for ad_id, cats_id in matches.items():
        try:
            client.table("ads").update(
                {"cats_content_id": cats_id}
            ).eq("ad_id", ad_id).execute()
            updated += 1
        except Exception as e:
            logger.error("Failed to set cats_content_id=%s for ad_id=%s: %s",
                         cats_id, ad_id, e)
    return updated


def get_lp_base_url_id(client: Client, project_id: int, url_type: str, base_url: str) -> int | None:
    """Get lp_base_urls ID by unique key."""
    result = (client.table("lp_base_urls")
              .select("id")
              .eq("project_id", project_id)
              .eq("url_type", url_type)
              .eq("base_url", base_url)
              .execute())
    return result.data[0]["id"] if result.data else None


def get_all_lp_base_urls(client: Client) -> list[dict]:
    """Get all lp_base_urls for reverse lookup (Notion page_id → Supabase id)."""
    result = client.table("lp_base_urls").select("*").execute()
    return result.data


# ---- lp_param_codes ----

def upsert_lp_param_codes(client: Client, rows: list[dict]) -> int:
    """Insert or update lp_param_codes (パラメータバリエーション)."""
    if not rows:
        return 0
    result = client.table("lp_param_codes").upsert(
        rows, on_conflict="notion_page_id"
    ).execute()
    return len(result.data)


def get_all_lp_param_codes(client: Client) -> list[dict]:
    """Get all lp_param_codes."""
    result = client.table("lp_param_codes").select("*").execute()
    return result.data
