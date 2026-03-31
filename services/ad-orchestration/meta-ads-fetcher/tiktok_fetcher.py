"""TikTok Ads API data fetcher.

Fetches ad performance data from TikTok Marketing API v1.3
and stores it in Supabase via tiktok_database.py.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from tiktok_auth import tiktok_api_request
from tiktok_database import upsert_tiktok_data, get_tiktok_accounts
from database import get_client

logger = logging.getLogger(__name__)

# TikTok Reporting API metrics to fetch
# These map to tiktok_daily_metrics columns
TIKTOK_METRICS = [
    # Core
    "spend",
    "impressions",
    "reach",
    "clicks",
    "cpc",
    "cpm",
    "ctr",
    # Video
    "video_play_actions",
    "video_watched_2s",
    "video_watched_6s",
    "average_video_play",
    "video_views_p25",
    "video_views_p50",
    "video_views_p75",
    "video_views_p100",
    # Social
    "likes",
    "comments",
    "shares",
    "follows",
    # Engagement
    "engaged_view",
    "engagements",
    "engagement_rate",
    # Conversion
    "conversion",
    "cost_per_conversion",
    "conversion_rate",
    "result",
    "cost_per_result",
    "result_rate",
    # Pixel events (website)
    "complete_payment",
    "cost_per_complete_payment",
    "page_content_view_events",
    "cost_per_page_content_view_event",
]

# Dimensions for ad-level daily breakdown
TIKTOK_DIMENSIONS = [
    "ad_id",
    "stat_time_day",
]

# Fields to fetch for ad entity info
AD_ENTITY_FIELDS = [
    "ad_id",
    "ad_name",
    "adgroup_id",
    "adgroup_name",
    "campaign_id",
    "campaign_name",
    "ad_format",
    "landing_page_url",
    "call_to_action",
    "video_id",
    "objective_type",
]


def fetch_tiktok_insights(
    advertiser_id: str,
    start_date: str,
    end_date: str,
    *,
    sandbox: bool = False,
) -> list[dict]:
    """Fetch TikTok ad performance data for an advertiser.

    Args:
        advertiser_id: TikTok advertiser ID
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        sandbox: Use sandbox environment

    Returns:
        List of parsed metric rows ready for upsert_tiktok_data()
    """
    logger.info(
        "Fetching TikTok insights for advertiser %s (%s to %s)",
        advertiser_id, start_date, end_date,
    )

    # Step 1: Get reporting data (metrics + ad_id + date)
    all_rows = []
    page = 1
    page_size = 100

    while True:
        params = {
            "advertiser_id": advertiser_id,
            "report_type": "BASIC",
            "data_level": "AUCTION_AD",
            "dimensions": json.dumps(TIKTOK_DIMENSIONS),
            "metrics": json.dumps(TIKTOK_METRICS),
            "start_date": start_date,
            "end_date": end_date,
            "page": page,
            "page_size": page_size,
        }

        data = tiktok_api_request(
            "GET",
            "/report/integrated/get/",
            params=params,
            sandbox=sandbox,
        )

        rows = data.get("list", [])
        if not rows:
            break

        all_rows.extend(rows)

        page_info = data.get("page_info", {})
        total_page = page_info.get("total_page", 1)
        if page >= total_page:
            break
        page += 1

    logger.info("Fetched %d metric rows from TikTok API", len(all_rows))

    # Step 2: Get ad entity details (names, campaign hierarchy)
    ad_ids = list({row["dimensions"]["ad_id"] for row in all_rows})
    ad_details = _fetch_ad_details(advertiser_id, ad_ids, sandbox=sandbox)

    # Step 3: Merge metrics with entity details
    parsed = []
    fetched_at = datetime.now(timezone.utc).isoformat()

    for row in all_rows:
        dims = row.get("dimensions", {})
        metrics = row.get("metrics", {})
        ad_id = dims.get("ad_id")
        stat_date = dims.get("stat_time_day", "")[:10]  # "2026-03-21 00:00:00" → "2026-03-21"

        detail = ad_details.get(ad_id, {})

        # Build actions list for conversion data
        actions = []
        if metrics.get("conversion"):
            actions.append((
                "conversion",
                _safe_int(metrics.get("conversion")),
                _safe_float(metrics.get("cost_per_conversion")),
            ))
        if metrics.get("result"):
            actions.append((
                "result",
                _safe_int(metrics.get("result")),
                _safe_float(metrics.get("cost_per_result")),
            ))
        if metrics.get("complete_payment"):
            actions.append((
                "complete_payment",
                _safe_int(metrics.get("complete_payment")),
                _safe_float(metrics.get("cost_per_complete_payment")),
            ))
        if metrics.get("page_content_view_events"):
            actions.append((
                "view_content",
                _safe_int(metrics.get("page_content_view_events")),
                _safe_float(metrics.get("cost_per_page_content_view_event")),
            ))

        parsed.append({
            "date": stat_date,
            "account_id": advertiser_id,
            "campaign_id": detail.get("campaign_id", ""),
            "campaign_name": detail.get("campaign_name", ""),
            "objective_type": detail.get("objective_type", ""),
            "adgroup_id": detail.get("adgroup_id", ""),
            "adgroup_name": detail.get("adgroup_name", ""),
            "ad_id": ad_id,
            "ad_name": detail.get("ad_name", ""),
            "ad_format": detail.get("ad_format", ""),
            "landing_page_url": detail.get("landing_page_url", ""),
            "call_to_action": detail.get("call_to_action", ""),
            "video_id": detail.get("video_id", ""),
            # Metrics (TikTok returns as strings)
            "spend": metrics.get("spend"),
            "impressions": metrics.get("impressions"),
            "reach": metrics.get("reach"),
            "clicks": metrics.get("clicks"),
            "cpc": metrics.get("cpc"),
            "cpm": metrics.get("cpm"),
            "ctr": metrics.get("ctr"),
            "video_play_actions": metrics.get("video_play_actions"),
            "video_watched_2s": metrics.get("video_watched_2s"),
            "video_watched_6s": metrics.get("video_watched_6s"),
            "average_video_play": metrics.get("average_video_play"),
            "video_views_p25": metrics.get("video_views_p25"),
            "video_views_p50": metrics.get("video_views_p50"),
            "video_views_p75": metrics.get("video_views_p75"),
            "video_views_p100": metrics.get("video_views_p100"),
            "likes": metrics.get("likes"),
            "comments": metrics.get("comments"),
            "shares": metrics.get("shares"),
            "follows": metrics.get("follows"),
            "engaged_view": metrics.get("engaged_view"),
            "engagements": metrics.get("engagements"),
            "engagement_rate": metrics.get("engagement_rate"),
            # Conversion actions
            "actions_parsed": actions,
            "fetched_at": fetched_at,
        })

    return parsed


def _fetch_ad_details(
    advertiser_id: str,
    ad_ids: list[str],
    *,
    sandbox: bool = False,
) -> dict[str, dict]:
    """Fetch ad entity details (names, hierarchy) for given ad IDs.

    Returns:
        Dict mapping ad_id → {ad_name, adgroup_id, campaign_id, ...}
    """
    if not ad_ids:
        return {}

    details = {}
    # TikTok /ad/get/ supports filtering by ad_ids (max ~100 per request)
    batch_size = 100

    for i in range(0, len(ad_ids), batch_size):
        batch = ad_ids[i:i + batch_size]

        params = {
            "advertiser_id": advertiser_id,
            "filtering": {
                "ad_ids": batch,
            },
            "page_size": batch_size,
        }

        data = tiktok_api_request(
            "GET",
            "/ad/get/",
            params=params,
            sandbox=sandbox,
        )

        for ad in data.get("list", []):
            ad_id = ad.get("ad_id")
            if ad_id:
                details[ad_id] = {
                    "ad_id": ad_id,
                    "ad_name": ad.get("ad_name", ""),
                    "adgroup_id": ad.get("adgroup_id", ""),
                    "adgroup_name": ad.get("adgroup_name", ""),
                    "campaign_id": ad.get("campaign_id", ""),
                    "campaign_name": ad.get("campaign_name", ""),
                    "ad_format": ad.get("ad_format", ""),
                    "landing_page_url": ad.get("landing_page_url", ""),
                    "call_to_action": ad.get("call_to_action", ""),
                    "video_id": ad.get("video_id", ""),
                    "objective_type": ad.get("objective_type", ""),
                }

    # Also fetch adgroup/campaign names if not included in ad response
    _enrich_hierarchy(advertiser_id, details, sandbox=sandbox)

    return details


def _enrich_hierarchy(
    advertiser_id: str,
    details: dict[str, dict],
    *,
    sandbox: bool = False,
) -> None:
    """Enrich ad details with campaign/adgroup names if missing."""
    # Collect unique adgroup and campaign IDs missing names
    missing_adgroups = {
        d["adgroup_id"]
        for d in details.values()
        if d.get("adgroup_id") and not d.get("adgroup_name")
    }
    missing_campaigns = {
        d["campaign_id"]
        for d in details.values()
        if d.get("campaign_id") and not d.get("campaign_name")
    }

    # Fetch adgroup names
    if missing_adgroups:
        adgroup_names = _fetch_entity_names(
            advertiser_id, "/adgroup/get/",
            list(missing_adgroups), "adgroup_ids", "adgroup_id", "adgroup_name",
            sandbox=sandbox,
        )
        for d in details.values():
            if d["adgroup_id"] in adgroup_names:
                d["adgroup_name"] = adgroup_names[d["adgroup_id"]]

    # Fetch campaign names
    if missing_campaigns:
        campaign_data = _fetch_entity_names(
            advertiser_id, "/campaign/get/",
            list(missing_campaigns), "campaign_ids", "campaign_id", "campaign_name",
            sandbox=sandbox,
        )
        for d in details.values():
            if d["campaign_id"] in campaign_data:
                d["campaign_name"] = campaign_data[d["campaign_id"]]


def _fetch_entity_names(
    advertiser_id: str,
    endpoint: str,
    entity_ids: list[str],
    filter_key: str,
    id_field: str,
    name_field: str,
    *,
    sandbox: bool = False,
) -> dict[str, str]:
    """Generic helper to fetch entity names by IDs."""
    result = {}
    batch_size = 100

    for i in range(0, len(entity_ids), batch_size):
        batch = entity_ids[i:i + batch_size]
        params = {
            "advertiser_id": advertiser_id,
            "filtering": {filter_key: batch},
            "page_size": batch_size,
        }
        data = tiktok_api_request("GET", endpoint, params=params, sandbox=sandbox)
        for item in data.get("list", []):
            eid = item.get(id_field)
            if eid:
                result[eid] = item.get(name_field, "")

    return result


def fetch_and_store_tiktok(
    advertiser_id: str,
    start_date: str,
    end_date: str,
    *,
    sandbox: bool = False,
) -> int:
    """Fetch TikTok insights and store to Supabase.

    Args:
        advertiser_id: TikTok advertiser ID
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD

    Returns:
        Number of metric rows stored.
    """
    rows = fetch_tiktok_insights(advertiser_id, start_date, end_date, sandbox=sandbox)
    if not rows:
        logger.info("No TikTok data to store for %s", advertiser_id)
        return 0

    client = get_client()
    count = upsert_tiktok_data(client, rows)
    logger.info("Stored %d TikTok metric rows for %s", count, advertiser_id)
    return count


# ============================================================
# AUDIENCE report: ディメンション別メトリクス取得
# ============================================================

# AUDIENCE report で使用可能なメトリクス (complete_payment等は使えない)
AUDIENCE_METRICS = [
    "spend", "impressions", "reach", "clicks", "cpc", "cpm", "ctr",
    "conversion", "cost_per_conversion", "result", "cost_per_result",
    "video_play_actions", "video_watched_2s",
    "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100",
    "engaged_view", "likes", "comments", "shares",
]

# ディメンション定義: (API dimension名, DBテーブル名, DBカラム名)
AUDIENCE_DIMENSIONS = [
    ("placement", "tiktok_metrics_by_placement", "placement"),
    ("age",       "tiktok_metrics_by_age",       "age_group"),
    ("gender",    "tiktok_metrics_by_gender",     "gender"),
    ("platform",  "tiktok_metrics_by_platform",   "platform"),
    ("province_id", "tiktok_metrics_by_province", "province_id"),
    ("ac",        "tiktok_metrics_by_ac",          "ac"),
]


def fetch_tiktok_audience(
    advertiser_id: str,
    start_date: str,
    end_date: str,
    dimension: str,
    *,
    sandbox: bool = False,
) -> list[dict]:
    """AUDIENCE reportでディメンション別メトリクスを取得.

    Args:
        dimension: placement, age, gender, platform, province_id, ac
    """
    logger.info(
        "Fetching TikTok AUDIENCE/%s for %s (%s to %s)",
        dimension, advertiser_id, start_date, end_date,
    )

    all_rows = []
    page = 1
    page_size = 100

    while True:
        params = {
            "advertiser_id": advertiser_id,
            "report_type": "AUDIENCE",
            "data_level": "AUCTION_AD",
            "dimensions": json.dumps(["ad_id", "stat_time_day", dimension]),
            "metrics": json.dumps(AUDIENCE_METRICS),
            "start_date": start_date,
            "end_date": end_date,
            "page": page,
            "page_size": page_size,
        }

        data = tiktok_api_request(
            "GET", "/report/integrated/get/",
            params=params, sandbox=sandbox,
        )

        rows = data.get("list", [])
        if not rows:
            break

        all_rows.extend(rows)

        page_info = data.get("page_info", {})
        if page >= page_info.get("total_page", 1):
            break
        page += 1

    logger.info("Fetched %d AUDIENCE/%s rows", len(all_rows), dimension)
    return all_rows


def fetch_and_store_tiktok_audience(
    advertiser_id: str,
    start_date: str,
    end_date: str,
    dimensions: list[str] | None = None,
    *,
    sandbox: bool = False,
) -> dict[str, int]:
    """全ディメンションのAUDIENCEレポートを取得してDBに保存.

    Args:
        dimensions: 取得するディメンション一覧。Noneなら全ディメンション。

    Returns:
        {dimension: row_count} のdict
    """
    client = get_client()
    results = {}

    target_dims = AUDIENCE_DIMENSIONS
    if dimensions:
        target_dims = [d for d in AUDIENCE_DIMENSIONS if d[0] in dimensions]

    for api_dim, table_name, db_col in target_dims:
        try:
            rows = fetch_tiktok_audience(
                advertiser_id, start_date, end_date, api_dim, sandbox=sandbox,
            )

            if not rows:
                results[api_dim] = 0
                continue

            # Parse and upsert
            upsert_rows = []
            for row in rows:
                dims = row.get("dimensions", {})
                metrics = row.get("metrics", {})

                ad_id = dims.get("ad_id")
                date = dims.get("stat_time_day", "")[:10]
                dim_value = dims.get(api_dim, "UNKNOWN")

                if not ad_id or not date:
                    continue

                record = {
                    "date": date,
                    "ad_id": ad_id,
                    db_col: dim_value,
                    "spend": _safe_float(metrics.get("spend")),
                    "impressions": _safe_int(metrics.get("impressions")),
                    "reach": _safe_int(metrics.get("reach")),
                    "clicks": _safe_int(metrics.get("clicks")),
                    "cpc": _safe_float(metrics.get("cpc")),
                    "cpm": _safe_float(metrics.get("cpm")),
                    "ctr": _safe_float(metrics.get("ctr")),
                    "conversion": _safe_int(metrics.get("conversion")),
                    "cost_per_conversion": _safe_float(metrics.get("cost_per_conversion")),
                }

                # テーブルによって追加カラムが異なる
                if table_name in ("tiktok_metrics_by_placement", "tiktok_metrics_by_age",
                                  "tiktok_metrics_by_gender", "tiktok_metrics_by_platform"):
                    record["video_play_actions"] = _safe_int(metrics.get("video_play_actions"))
                    record["video_watched_2s"] = _safe_int(metrics.get("video_watched_2s"))
                    record["engaged_view"] = _safe_int(metrics.get("engaged_view"))

                if table_name in ("tiktok_metrics_by_placement",):
                    record["result"] = _safe_int(metrics.get("result"))
                    record["cost_per_result"] = _safe_float(metrics.get("cost_per_result"))
                    record["video_views_p25"] = _safe_int(metrics.get("video_views_p25"))
                    record["video_views_p50"] = _safe_int(metrics.get("video_views_p50"))
                    record["video_views_p75"] = _safe_int(metrics.get("video_views_p75"))
                    record["video_views_p100"] = _safe_int(metrics.get("video_views_p100"))

                if table_name in ("tiktok_metrics_by_placement", "tiktok_metrics_by_age",
                                  "tiktok_metrics_by_gender"):
                    record["likes"] = _safe_int(metrics.get("likes"))
                    record["comments"] = _safe_int(metrics.get("comments"))
                    record["shares"] = _safe_int(metrics.get("shares"))

                upsert_rows.append(record)

            # Batch upsert
            if upsert_rows:
                from database import _safe_upsert
                count = _safe_upsert(
                    client, table_name, upsert_rows,
                    on_conflict="date,ad_id," + db_col,
                )
                results[api_dim] = count
                logger.info("Stored %d rows in %s", count, table_name)
            else:
                results[api_dim] = 0

        except Exception as e:
            logger.error("Failed to fetch AUDIENCE/%s: %s", api_dim, e)
            results[api_dim] = -1

    return results


# ---- helpers ----

def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
