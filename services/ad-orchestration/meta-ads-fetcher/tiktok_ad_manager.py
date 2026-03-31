"""TikTok Ads API ad management (Campaign/AdGroup/Ad CRUD).

Handles creation, updating, and status management of TikTok ad entities.
"""

import logging
import uuid
from datetime import datetime

from tiktok_auth import tiktok_api_request, TikTokAPIError

logger = logging.getLogger(__name__)


# ============================================================
# Campaign
# ============================================================

def create_campaign(
    advertiser_id: str,
    campaign_name: str,
    objective_type: str = "WEB_CONVERSIONS",
    budget_mode: str = "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
    budget: float | None = None,
    *,
    campaign_automation_type: str = "MANUAL",
    sandbox: bool = False,
) -> dict:
    """Create a TikTok campaign.

    Args:
        advertiser_id: TikTok advertiser ID
        campaign_name: Campaign display name
        objective_type: WEB_CONVERSIONS, TRAFFIC, etc.
        budget_mode: BUDGET_MODE_DYNAMIC_DAILY_BUDGET, BUDGET_MODE_DAY, BUDGET_MODE_INFINITE
        budget: Budget amount in JPY (None for infinite)
        campaign_automation_type: MANUAL or UPGRADED_SMART_PLUS

    Returns:
        API response data with campaign_id
    """
    payload = {
        "advertiser_id": advertiser_id,
        "campaign_name": campaign_name,
        "objective_type": objective_type,
        "budget_mode": budget_mode,
        "campaign_automation_type": campaign_automation_type,
    }
    if budget is not None:
        payload["budget"] = budget

    data = tiktok_api_request("POST", "/campaign/create/", json_body=payload, sandbox=sandbox)
    campaign_id = data.get("campaign_id")
    logger.info("Created TikTok campaign: %s (id=%s, type=%s)", campaign_name, campaign_id, campaign_automation_type)
    return data


def get_campaigns(
    advertiser_id: str,
    campaign_ids: list[str] | None = None,
    *,
    sandbox: bool = False,
) -> list[dict]:
    """Get TikTok campaigns for an advertiser."""
    params = {
        "advertiser_id": advertiser_id,
        "page_size": 100,
    }
    if campaign_ids:
        params["filtering"] = {"campaign_ids": campaign_ids}

    data = tiktok_api_request("GET", "/campaign/get/", params=params, sandbox=sandbox)
    return data.get("list", [])


def update_campaign_status(
    advertiser_id: str,
    campaign_ids: list[str],
    status: str,
    *,
    sandbox: bool = False,
) -> dict:
    """Update campaign status (ENABLE, DISABLE, DELETE).

    Args:
        status: ENABLE, DISABLE, DELETE
    """
    payload = {
        "advertiser_id": advertiser_id,
        "campaign_ids": campaign_ids,
        "opt_status": status,
    }
    return tiktok_api_request("POST", "/campaign/status/update/", json_body=payload, sandbox=sandbox)


# ============================================================
# Ad Group
# ============================================================

def create_adgroup(
    advertiser_id: str,
    campaign_id: str,
    adgroup_name: str,
    *,
    placement_type: str = "PLACEMENT_TYPE_AUTOMATIC",
    placements: list[str] | None = None,
    budget_mode: str = "BUDGET_MODE_DAY",
    budget: float | None = None,
    schedule_type: str = "SCHEDULE_FROM_NOW",
    schedule_start_time: str | None = None,
    schedule_end_time: str | None = None,
    optimize_goal: str = "CONVERT",
    bid_type: str = "BID_TYPE_NO_BID",
    bid_amount: float | None = None,
    billing_event: str = "OCPM",
    location_ids: list[int] | None = None,
    age_groups: list[str] | None = None,
    gender: str | None = None,
    languages: list[str] | None = None,
    pixel_id: str | None = None,
    optimization_event: str | None = None,
    custom_audiences: list[dict] | None = None,
    audience_suggestion: dict | None = None,
    comment_disabled: bool | None = None,
    video_download_disabled: bool | None = None,
    share_disabled: bool | None = None,
    attribution_click_window: str | None = None,
    attribution_view_window: str | None = None,
    event_counting: str | None = None,
    promotion_type: str | None = None,
    search_result_enabled: bool | None = None,
    skip_learning_phase: bool | None = None,
    sandbox: bool = False,
) -> dict:
    """Create a TikTok ad group.

    Args:
        advertiser_id: TikTok advertiser ID
        campaign_id: Parent campaign ID
        adgroup_name: Ad group display name
        placement_type: PLACEMENT_TYPE_AUTOMATIC or PLACEMENT_TYPE_NORMAL
        budget_mode: BUDGET_MODE_DAY, BUDGET_MODE_TOTAL
        budget: Budget in JPY
        schedule_type: SCHEDULE_FROM_NOW or SCHEDULE_START_END
        optimize_goal: CONVERT, CLICK, REACH, etc.
        bid_type: BID_TYPE_NO_BID (auto), BID_TYPE_CPC, etc.
        billing_event: OCPM, CPC, CPM
        location_ids: List of TikTok location IDs (Japan=392)
        age_groups: e.g. ["AGE_18_24", "AGE_25_34"]
        gender: GENDER_MALE, GENDER_FEMALE, or None for all
        pixel_id: TikTok pixel ID for conversion tracking

    Returns:
        API response data with adgroup_id
    """
    payload = {
        "advertiser_id": advertiser_id,
        "campaign_id": campaign_id,
        "adgroup_name": adgroup_name,
        "placement_type": placement_type,
        "budget_mode": budget_mode,
        "schedule_type": schedule_type,
        "optimize_goal": optimize_goal,
        "bid_type": bid_type,
        "billing_event": billing_event,
    }

    if budget is not None:
        payload["budget"] = budget
    if schedule_start_time:
        payload["schedule_start_time"] = schedule_start_time
    if schedule_end_time:
        payload["schedule_end_time"] = schedule_end_time
    if location_ids:
        payload["location_ids"] = location_ids
    if age_groups:
        payload["age_groups"] = age_groups
    if gender:
        payload["gender"] = gender
    if languages:
        payload["languages"] = languages
    if pixel_id:
        payload["pixel_id"] = pixel_id
    if optimization_event:
        payload["optimization_event"] = optimization_event
    if bid_amount is not None:
        payload["bid"] = bid_amount
    if placements:
        payload["placements"] = placements
    if custom_audiences:
        payload["audience_ids"] = custom_audiences
    if audience_suggestion:
        payload["audience_suggestion"] = audience_suggestion
    if comment_disabled is not None:
        payload["comment_disabled"] = comment_disabled
    if video_download_disabled is not None:
        payload["video_download_disabled"] = video_download_disabled
    if share_disabled is not None:
        payload["share_disabled"] = share_disabled
    if attribution_click_window:
        payload["click_attribution_window"] = attribution_click_window
    if attribution_view_window:
        payload["view_attribution_window"] = attribution_view_window
    if event_counting:
        payload["attribution_event_count"] = event_counting  # EVERY or UNIQUE
    if promotion_type:
        payload["promotion_type"] = promotion_type
    if search_result_enabled is not None:
        payload["search_result_enabled"] = search_result_enabled
    if skip_learning_phase is not None:
        payload["skip_learning_phase"] = skip_learning_phase

    data = tiktok_api_request("POST", "/adgroup/create/", json_body=payload, sandbox=sandbox)
    adgroup_id = data.get("adgroup_id")
    logger.info("Created TikTok ad group: %s (id=%s)", adgroup_name, adgroup_id)
    return data


def get_adgroups(
    advertiser_id: str,
    campaign_ids: list[str] | None = None,
    adgroup_ids: list[str] | None = None,
    *,
    sandbox: bool = False,
) -> list[dict]:
    """Get TikTok ad groups."""
    params = {
        "advertiser_id": advertiser_id,
        "page_size": 100,
    }
    filtering = {}
    if campaign_ids:
        filtering["campaign_ids"] = campaign_ids
    if adgroup_ids:
        filtering["adgroup_ids"] = adgroup_ids
    if filtering:
        params["filtering"] = filtering

    data = tiktok_api_request("GET", "/adgroup/get/", params=params, sandbox=sandbox)
    return data.get("list", [])


def update_adgroup_status(
    advertiser_id: str,
    adgroup_ids: list[str],
    status: str,
    *,
    sandbox: bool = False,
) -> dict:
    """Update ad group status (ENABLE, DISABLE, DELETE)."""
    payload = {
        "advertiser_id": advertiser_id,
        "adgroup_ids": adgroup_ids,
        "opt_status": status,
    }
    return tiktok_api_request("POST", "/adgroup/status/update/", json_body=payload, sandbox=sandbox)


# ============================================================
# Ad
# ============================================================

def create_ad(
    advertiser_id: str,
    adgroup_id: str,
    ad_name: str,
    *,
    video_id: str | None = None,
    video_ids: list[str] | None = None,
    image_ids: list[str] | None = None,
    ad_text: str = "",
    ad_format: str = "SINGLE_VIDEO",
    display_name: str = "",
    call_to_action: str = "LEARN_MORE",
    landing_page_url: str = "",
    identity_id: str | None = None,
    identity_type: str | None = None,
    auto_enhance_disabled: bool = True,
    interactive_addon_config: dict | None = None,
    sandbox: bool = False,
) -> dict:
    """Create a TikTok ad.

    Args:
        advertiser_id: TikTok advertiser ID
        adgroup_id: Parent ad group ID
        ad_name: Ad display name
        video_id: Single video asset ID (manual campaign)
        video_ids: Multiple video asset IDs (Smart+ campaign, 1-50)
        ad_text: Main ad text (caption)
        ad_format: SINGLE_VIDEO, SINGLE_IMAGE, etc.
        display_name: Display name shown on ad
        call_to_action: LEARN_MORE, SIGN_UP, SHOP_NOW, etc.
        landing_page_url: Destination URL
        identity_id: TikTok identity ID
        identity_type: CUSTOMIZED_USER, BC_AUTH_TT, etc.
        auto_enhance_disabled: Disable all auto-enhancements (default True)
        interactive_addon_config: Optional interactive addon settings

    Returns:
        API response data with ad_ids
    """
    # Build creatives array
    # Smart+: multiple video_ids → multiple creative entries
    # Manual: single video_id → single creative entry
    all_video_ids = video_ids or ([video_id] if video_id else [])

    creatives_list = []
    for vid in all_video_ids:
        creative = {
            "ad_format": ad_format,
            "ad_text": ad_text,
            "display_name": display_name,
            "call_to_action": call_to_action,
            "video_id": vid,
        }
        if image_ids:
            creative["image_ids"] = image_ids
        creatives_list.append(creative)

    payload = {
        "advertiser_id": advertiser_id,
        "adgroup_id": adgroup_id,
        "ad_name": ad_name,
        "creatives": creatives_list,
    }
    if landing_page_url:
        payload["landing_page_url"] = landing_page_url
    if identity_id:
        payload["identity_id"] = identity_id
    if identity_type:
        payload["identity_type"] = identity_type

    # Auto-enhancement: all OFF
    if auto_enhance_disabled:
        payload["creative_authorized"] = False
        payload["branded_content_disabled"] = True

    if interactive_addon_config:
        payload["interactive_addon"] = interactive_addon_config

    data = tiktok_api_request("POST", "/ad/create/", json_body=payload, sandbox=sandbox)
    ad_ids = data.get("ad_ids", [])
    logger.info("Created TikTok ad: %s (ids=%s, %d videos)", ad_name, ad_ids, len(all_video_ids))
    return data


def get_ads(
    advertiser_id: str,
    adgroup_ids: list[str] | None = None,
    ad_ids: list[str] | None = None,
    *,
    sandbox: bool = False,
) -> list[dict]:
    """Get TikTok ads."""
    params = {
        "advertiser_id": advertiser_id,
        "page_size": 100,
    }
    filtering = {}
    if adgroup_ids:
        filtering["adgroup_ids"] = adgroup_ids
    if ad_ids:
        filtering["ad_ids"] = ad_ids
    if filtering:
        params["filtering"] = filtering

    data = tiktok_api_request("GET", "/ad/get/", params=params, sandbox=sandbox)
    return data.get("list", [])


def update_ad_status(
    advertiser_id: str,
    ad_ids: list[str],
    status: str,
    *,
    sandbox: bool = False,
) -> dict:
    """Update ad status (ENABLE, DISABLE, DELETE)."""
    payload = {
        "advertiser_id": advertiser_id,
        "ad_ids": ad_ids,
        "opt_status": status,
    }
    return tiktok_api_request("POST", "/ad/status/update/", json_body=payload, sandbox=sandbox)


# ============================================================
# File Upload (Video / Image)
# ============================================================

def upload_video_by_url(
    advertiser_id: str,
    video_url: str,
    file_name: str | None = None,
    *,
    sandbox: bool = False,
) -> dict:
    """Upload a video to TikTok by URL.

    Args:
        advertiser_id: TikTok advertiser ID
        video_url: Public URL of the video file
        file_name: Optional filename

    Returns:
        API response with video_id
    """
    payload = {
        "advertiser_id": advertiser_id,
        "upload_type": "UPLOAD_BY_URL",
        "video_url": video_url,
    }
    if file_name:
        payload["file_name"] = file_name

    data = tiktok_api_request("POST", "/file/video/ad/upload/", json_body=payload, sandbox=sandbox)
    video_id = data.get("video_id")
    logger.info("Uploaded video to TikTok: %s (video_id=%s)", file_name or video_url, video_id)
    return data


def upload_image_by_url(
    advertiser_id: str,
    image_url: str,
    file_name: str | None = None,
    *,
    sandbox: bool = False,
) -> dict:
    """Upload an image to TikTok by URL.

    Returns:
        API response with image id
    """
    payload = {
        "advertiser_id": advertiser_id,
        "upload_type": "UPLOAD_BY_URL",
        "image_url": image_url,
    }
    if file_name:
        payload["file_name"] = file_name

    return tiktok_api_request("POST", "/file/image/ad/upload/", json_body=payload, sandbox=sandbox)


# ============================================================
# Full submission flow
# ============================================================

def submit_tiktok_ad(
    advertiser_id: str,
    *,
    campaign_name: str,
    adgroup_name: str,
    ad_name: str,
    video_url: str,
    landing_page_url: str,
    ad_text: str = "",
    display_name: str = "",
    objective_type: str = "CONVERSIONS",
    budget: float | None = None,
    location_ids: list[int] | None = None,
    age_groups: list[str] | None = None,
    optimize_goal: str = "CONVERT",
    pixel_id: str | None = None,
    call_to_action: str = "LEARN_MORE",
    sandbox: bool = False,
) -> dict:
    """Full submission: create Campaign → AdGroup → upload Video → create Ad.

    Returns:
        Dict with campaign_id, adgroup_id, ad_id, video_id
    """
    # Default Japan targeting
    if location_ids is None:
        location_ids = [392]  # Japan country-level

    # 1. Create Campaign
    campaign_data = create_campaign(
        advertiser_id, campaign_name,
        objective_type=objective_type,
        budget_mode="BUDGET_MODE_DAY" if budget else "BUDGET_MODE_INFINITE",
        budget=budget,
        sandbox=sandbox,
    )
    campaign_id = campaign_data["campaign_id"]

    # 2. Create Ad Group
    adgroup_data = create_adgroup(
        advertiser_id, campaign_id, adgroup_name,
        budget_mode="BUDGET_MODE_DAY" if budget else "BUDGET_MODE_INFINITE",
        budget=budget,
        optimize_goal=optimize_goal,
        location_ids=location_ids,
        age_groups=age_groups,
        pixel_id=pixel_id,
        sandbox=sandbox,
    )
    adgroup_id = adgroup_data["adgroup_id"]

    # 3. Upload Video
    video_data = upload_video_by_url(
        advertiser_id, video_url,
        sandbox=sandbox,
    )
    video_id = video_data["video_id"]

    # 4. Create Ad
    ad_data = create_ad(
        advertiser_id, adgroup_id, ad_name,
        video_id=video_id,
        ad_text=ad_text,
        display_name=display_name,
        call_to_action=call_to_action,
        landing_page_url=landing_page_url,
        sandbox=sandbox,
    )
    ad_id = ad_data.get("ad_ids", [None])[0]

    result = {
        "campaign_id": campaign_id,
        "adgroup_id": adgroup_id,
        "video_id": video_id,
        "ad_id": ad_id,
    }
    logger.info("TikTok ad submission complete: %s", result)
    return result
