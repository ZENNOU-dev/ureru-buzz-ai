"""Supabase database operations for TikTok Ads data.

Mirrors database.py structure for Meta, using the same _safe_upsert pattern.
"""

import logging
from datetime import datetime, timezone

from supabase import Client

from database import get_client, _safe_upsert

logger = logging.getLogger(__name__)


# ---- TikTok dimension upserts ----

def upsert_tiktok_campaigns(client: Client, rows: list[dict]) -> int:
    """Upsert TikTok campaigns."""
    return _safe_upsert(client, "tiktok_campaigns", rows, "campaign_id", "campaign_name")


def upsert_tiktok_adgroups(client: Client, rows: list[dict]) -> int:
    """Upsert TikTok ad groups."""
    return _safe_upsert(client, "tiktok_adgroups", rows, "adgroup_id", "adgroup_name")


def upsert_tiktok_ads(client: Client, rows: list[dict]) -> int:
    """Upsert TikTok ads."""
    return _safe_upsert(client, "tiktok_ads", rows, "ad_id", "ad_name")


def upsert_tiktok_daily_metrics(client: Client, rows: list[dict]) -> int:
    """Upsert TikTok daily metrics."""
    return _safe_upsert(client, "tiktok_daily_metrics", rows, "date,ad_id", "ad_id")


def upsert_tiktok_action_stats(client: Client, rows: list[dict]) -> int:
    """Upsert TikTok action stats (conversion data)."""
    return _safe_upsert(client, "tiktok_action_stats", rows, "date,ad_id,action_type", "ad_id")


# ---- combined upsert for TikTok fetcher ----

def upsert_tiktok_data(client: Client, rows: list[dict]) -> int:
    """Upsert a batch of TikTok ad data to normalized tables.

    Each row contains campaign/adgroup/ad info + metrics + actions.
    Splits and writes to:
      1. tiktok_campaigns
      2. tiktok_adgroups
      3. tiktok_ads
      4. tiktok_daily_metrics
      5. tiktok_action_stats

    Returns total metrics rows written.
    """
    if not rows:
        return 0

    campaigns = {}
    adgroups = {}
    ads = {}
    metrics = []
    action_stats = []

    for row in rows:
        campaign_id = row["campaign_id"]
        adgroup_id = row["adgroup_id"]
        ad_id = row["ad_id"]

        if campaign_id and campaign_id not in campaigns:
            campaigns[campaign_id] = {
                "campaign_id": campaign_id,
                "campaign_name": row.get("campaign_name"),
                "account_id": row["account_id"],
                "objective_type": row.get("objective_type"),
                "budget_mode": row.get("budget_mode"),
                "budget": row.get("campaign_budget"),
                "status": row.get("campaign_status"),
            }

        if adgroup_id and adgroup_id not in adgroups:
            adgroups[adgroup_id] = {
                "adgroup_id": adgroup_id,
                "adgroup_name": row.get("adgroup_name"),
                "campaign_id": campaign_id,
                "placement_type": row.get("placement_type"),
                "bid_type": row.get("bid_type"),
                "optimize_goal": row.get("optimize_goal"),
                "budget": row.get("adgroup_budget"),
                "status": row.get("adgroup_status"),
            }

        if ad_id and ad_id not in ads:
            ads[ad_id] = {
                "ad_id": ad_id,
                "ad_name": row.get("ad_name"),
                "adgroup_id": adgroup_id,
                "ad_format": row.get("ad_format"),
                "landing_page_url": row.get("landing_page_url"),
                "call_to_action": row.get("call_to_action"),
                "video_id": row.get("video_id"),
                "status": row.get("ad_status"),
            }

        # Metrics — TikTok returns spend as string
        metrics.append({
            "date": row["date"],
            "ad_id": ad_id,
            "spend": _parse_numeric(row.get("spend")),
            "impressions": _parse_int(row.get("impressions")),
            "reach": _parse_int(row.get("reach")),
            "clicks": _parse_int(row.get("clicks")),
            "cpc": _parse_numeric(row.get("cpc")),
            "cpm": _parse_numeric(row.get("cpm")),
            "ctr": _parse_numeric(row.get("ctr")),
            "video_play_actions": _parse_int(row.get("video_play_actions")),
            "video_watched_2s": _parse_int(row.get("video_watched_2s")),
            "video_watched_6s": _parse_int(row.get("video_watched_6s")),
            "average_video_play": _parse_numeric(row.get("average_video_play")),
            "video_views_p25": _parse_int(row.get("video_views_p25")),
            "video_views_p50": _parse_int(row.get("video_views_p50")),
            "video_views_p75": _parse_int(row.get("video_views_p75")),
            "video_views_p100": _parse_int(row.get("video_views_p100")),
            "likes": _parse_int(row.get("likes")),
            "comments": _parse_int(row.get("comments")),
            "shares": _parse_int(row.get("shares")),
            "follows": _parse_int(row.get("follows")),
            "engaged_view": _parse_int(row.get("engaged_view")),
            "engagements": _parse_int(row.get("engagements")),
            "engagement_rate": _parse_numeric(row.get("engagement_rate")),
            "fetched_at": row.get("fetched_at", datetime.now(timezone.utc).isoformat()),
        })

        # Action stats (conversions)
        for action_type, value, cost in row.get("actions_parsed", []):
            if value and value > 0:
                action_stats.append({
                    "date": row["date"],
                    "ad_id": ad_id,
                    "action_type": action_type,
                    "value": value,
                    "cost_per_action": cost,
                })

    # Upsert in FK dependency order
    upsert_tiktok_campaigns(client, list(campaigns.values()))
    upsert_tiktok_adgroups(client, list(adgroups.values()))
    upsert_tiktok_ads(client, list(ads.values()))
    upsert_tiktok_daily_metrics(client, metrics)
    if action_stats:
        upsert_tiktok_action_stats(client, action_stats)

    return len(metrics)


# ---- helpers ----

def _parse_numeric(val) -> float | None:
    """Parse TikTok API string/number to float. Returns None on failure."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_int(val) -> int | None:
    """Parse TikTok API string/number to int. Returns None on failure."""
    if val is None:
        return None
    try:
        return int(float(val))  # handle "123.0" strings
    except (ValueError, TypeError):
        return None


# ---- query helpers ----

def get_tiktok_accounts(client: Client) -> list[dict]:
    """Get all TikTok ad accounts."""
    result = (client.table("ad_accounts")
              .select("*")
              .eq("platform", "tiktok")
              .execute())
    return result.data or []
