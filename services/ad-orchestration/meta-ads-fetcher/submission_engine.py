"""Meta Ads Submission Engine.

Reads submission data from Supabase, downloads video from Google Drive,
uploads to Meta API, and creates Campaign → Adset → Ad.

Usage:
    python3 submission_engine.py <submission_id>
    python3 submission_engine.py --dry-run <submission_id>
"""

import io
import os
import re
import sys
import json
import logging
import tempfile
import argparse
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

GRAPH_API_VERSION = os.getenv("META_API_VERSION", "v21.0")
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Creative enhancements: ALL OFF
# v22.0+: individual feature keys (lowercase), replaces old STANDARD_ENHANCEMENTS bundle
# See: https://developers.facebook.com/docs/marketing-api/creative/advantage-creative/get-started/
CREATIVE_ENHANCEMENTS_OFF = {
    "degrees_of_freedom_spec": {
        "creative_features_spec": {
            # Advantage+ Creative features (v22.0+ keys)
            "adapt_to_placement": {"enroll_status": "OPT_OUT"},
            "add_text_overlay": {"enroll_status": "OPT_OUT"},
            "creative_stickers": {"enroll_status": "OPT_OUT"},
            "description_automation": {"enroll_status": "OPT_OUT"},
            "enhance_cta": {"enroll_status": "OPT_OUT"},
            "image_brightness_and_contrast": {"enroll_status": "OPT_OUT"},
            "image_background_gen": {"enroll_status": "OPT_OUT"},
            "image_templates": {"enroll_status": "OPT_OUT"},
            "image_touchups": {"enroll_status": "OPT_OUT"},
            "image_uncrop": {"enroll_status": "OPT_OUT"},
            "inline_comment": {"enroll_status": "OPT_OUT"},
            "media_type_automation": {"enroll_status": "OPT_OUT"},
            "product_extensions": {"enroll_status": "OPT_OUT"},
            "reveal_details_over_time": {"enroll_status": "OPT_OUT"},
            "text_optimizations": {"enroll_status": "OPT_OUT"},
            "text_translation": {"enroll_status": "OPT_OUT"},
            "video_auto_crop": {"enroll_status": "OPT_OUT"},
            # Legacy keys (still accepted)
            "standard_enhancements_catalog": {"enroll_status": "OPT_OUT"},
            "ig_video_native_subtitle": {"enroll_status": "OPT_OUT"},
            "product_metadata_automation": {"enroll_status": "OPT_OUT"},
            "profile_card": {"enroll_status": "OPT_OUT"},
        }
    },
    # Multi-advertiser ads: OFF
    "contextual_multi_ads": {"enroll_status": "OPT_OUT"},
}


# ---- Supabase helpers ----

def get_client() -> Client:
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


def load_submission(client: Client, submission_id: int) -> dict:
    """Load full submission with campaigns → adsets → ads."""
    sub = (client.table("ad_submissions")
           .select("*")
           .eq("id", submission_id)
           .single()
           .execute()).data

    campaigns = (client.table("submission_campaigns")
                 .select("*")
                 .eq("submission_id", submission_id)
                 .order("id")
                 .execute()).data

    for camp in campaigns:
        adsets = (client.table("submission_adsets")
                  .select("*")
                  .eq("campaign_id", camp["id"])
                  .order("id")
                  .execute()).data

        for adset in adsets:
            ads = (client.table("submission_ads")
                   .select("*")
                   .eq("adset_id", adset["id"])
                   .order("id")
                   .execute()).data
            adset["ads"] = ads

        camp["adsets"] = adsets

    sub["campaigns"] = campaigns
    return sub


def load_account_assets(client: Client, submission: dict) -> dict:
    """Load FB page, pixel, IG account from submission or account_assets."""
    assets = {}

    # From submission-level overrides
    for field, key in [
        ("facebook_page_asset_id", "facebook_page"),
        ("pixel_asset_id", "pixel"),
        ("instagram_asset_id", "instagram_account"),
    ]:
        asset_id = submission.get(field)
        if asset_id:
            row = (client.table("account_assets")
                   .select("*")
                   .eq("id", asset_id)
                   .single()
                   .execute()).data
            assets[key] = row

    # Fallback: default assets for this account
    if "facebook_page" not in assets:
        row = (client.table("account_assets")
               .select("*")
               .eq("account_id", submission["account_id"])
               .eq("asset_type", "facebook_page")
               .eq("is_default", True)
               .limit(1)
               .execute()).data
        if row:
            assets["facebook_page"] = row[0]

    if "pixel" not in assets:
        row = (client.table("account_assets")
               .select("*")
               .eq("account_id", submission["account_id"])
               .eq("asset_type", "pixel")
               .eq("is_default", True)
               .limit(1)
               .execute()).data
        if row:
            assets["pixel"] = row[0]

    return assets


def update_submission_status(client: Client, submission_id: int, status: str,
                              error_message: str = None):
    data = {"status": status}
    if error_message:
        data["error_message"] = error_message
    if status == "completed":
        data["submitted_at"] = datetime.now(timezone.utc).isoformat()
    client.table("ad_submissions").update(data).eq("id", submission_id).execute()


# ---- Google Drive helpers ----

def extract_drive_file_id(url: str) -> str:
    """Extract file ID from various Google Drive URL formats."""
    # https://drive.google.com/file/d/FILE_ID/view
    m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    # https://drive.google.com/open?id=FILE_ID
    m = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    raise ValueError(f"Cannot extract file ID from Drive URL: {url}")


def get_drive_direct_url(drive_url: str) -> str:
    """Get a direct download URL for a Google Drive file (bypasses virus scan).

    Returns a URL that Meta API can use via file_url parameter.
    """
    file_id = extract_drive_file_id(drive_url)
    session = requests.Session()
    resp = session.get(f"https://drive.google.com/uc?export=download&id={file_id}", timeout=30)

    if "text/html" in resp.headers.get("Content-Type", ""):
        import re as _re
        m_uuid = _re.search(r'name="uuid"\s+value="([^"]*)"', resp.text)
        if m_uuid:
            return (
                f"https://drive.usercontent.google.com/download"
                f"?id={file_id}&export=download&confirm=t&uuid={m_uuid.group(1)}"
            )
    # Small file: direct URL works
    return f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"


def download_from_drive(drive_url: str, api_key: str = None) -> tuple[bytes, str]:
    """Download file from Google Drive.

    Returns (file_bytes, filename).
    Uses direct download URL. For large files may need OAuth.
    """
    file_id = extract_drive_file_id(drive_url)

    # Try direct download first
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    if api_key:
        download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&key={api_key}"

    logger.info(f"Downloading from Drive: file_id={file_id}")
    session = requests.Session()
    resp = session.get(download_url, stream=True, timeout=300)

    # Handle Google's virus scan confirmation for large files
    if "text/html" in resp.headers.get("Content-Type", "") and not api_key:
        # Method 1: cookie-based confirm token (legacy)
        for key, value in resp.cookies.items():
            if key.startswith("download_warning"):
                download_url = f"{download_url}&confirm={value}"
                resp = session.get(download_url, stream=True, timeout=300)
                break
        else:
            # Method 2: parse uuid from confirmation page → usercontent URL (2024+)
            import re as _re
            m_uuid = _re.search(r'name="uuid"\s+value="([^"]*)"', resp.text)
            if m_uuid:
                uuid_val = m_uuid.group(1)
                usercontent_url = (
                    f"https://drive.usercontent.google.com/download"
                    f"?id={file_id}&export=download&confirm=t&uuid={uuid_val}"
                )
                logger.info(f"Virus scan bypass: using usercontent URL with uuid={uuid_val[:8]}...")
                resp = session.get(usercontent_url, timeout=600)

    resp.raise_for_status()

    content = resp.content
    # Try to get filename from content-disposition
    cd = resp.headers.get("Content-Disposition", "")
    filename_match = re.search(r'filename="?([^";\n]+)"?', cd)
    filename = filename_match.group(1) if filename_match else f"{file_id}.mp4"

    logger.info(f"Downloaded {len(content)} bytes: {filename}")
    return content, filename


# ---- Meta API helpers ----

def get_access_token() -> str:
    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise ValueError("META_ACCESS_TOKEN is required")
    return token


def meta_api_post(endpoint: str, params: dict, token: str, files: dict = None) -> dict:
    """POST to Meta Graph API using form data (not JSON body)."""
    url = f"{GRAPH_API_BASE}/{endpoint}"
    params["access_token"] = token

    if files:
        resp = requests.post(url, data=params, files=files, timeout=300)
    else:
        resp = requests.post(url, data=params, timeout=120)

    data = resp.json()
    if "error" in data:
        error = data["error"]
        msg = error.get('message', '')
        user_msg = error.get('error_user_msg', '')
        user_title = error.get('error_user_title', '')
        detail = f"{msg}"
        if user_title:
            detail += f" | {user_title}"
        if user_msg:
            detail += f" | {user_msg}"
        raise MetaAPIError(
            f"Meta API error: {detail} "
            f"(code={error.get('code')}, subcode={error.get('error_subcode')})",
            error_data=error,
        )
    return data


class MetaAPIError(Exception):
    def __init__(self, message, error_data=None):
        super().__init__(message)
        self.error_data = error_data or {}


# ---- Video upload ----

def _resumable_upload(account_id: str, file_path_or_bytes, filename: str,
                      token: str, chunk_size: int = 4 * 1024 * 1024) -> str:
    """Upload a video via Meta's resumable upload protocol.

    Args:
        account_id: Meta ad account ID (e.g. "act_123456").
        file_path_or_bytes: Either a file path (str) or raw bytes.
        filename: Display filename for the video.
        token: Meta API access token.
        chunk_size: Bytes per chunk (default 4 MB).

    Returns:
        video_id (str).
    """
    url = f"{GRAPH_API_BASE}/{account_id}/advideos"

    # Normalise input to bytes
    if isinstance(file_path_or_bytes, str):
        with open(file_path_or_bytes, "rb") as f:
            file_bytes = f.read()
    else:
        file_bytes = file_path_or_bytes

    file_size = len(file_bytes)
    logger.info(f"Resumable upload: {filename} ({file_size} bytes, chunk_size={chunk_size})")

    # --- Phase 1: start ---
    resp = requests.post(url, data={
        "access_token": token,
        "upload_phase": "start",
        "file_size": str(file_size),
    }, timeout=60)
    data = resp.json()
    if "error" in data:
        raise MetaAPIError(
            f"Resumable upload start failed: {data['error'].get('message', '')}",
            error_data=data["error"],
        )

    upload_session_id = data["upload_session_id"]
    video_id = data["video_id"]
    start_offset = int(data["start_offset"])
    end_offset = int(data["end_offset"])
    logger.info(f"Resumable upload started: session={upload_session_id}, video_id={video_id}")

    # --- Phase 2: transfer chunks ---
    while start_offset < file_size:
        chunk = file_bytes[start_offset:end_offset]
        logger.info(f"Resumable upload chunk: {start_offset}-{end_offset} ({len(chunk)} bytes)")
        resp = requests.post(url, data={
            "access_token": token,
            "upload_phase": "transfer",
            "upload_session_id": upload_session_id,
            "start_offset": str(start_offset),
        }, files={
            "video_file_chunk": (filename, io.BytesIO(chunk), "application/octet-stream"),
        }, timeout=300)
        data = resp.json()
        if "error" in data:
            raise MetaAPIError(
                f"Resumable upload transfer failed at offset {start_offset}: "
                f"{data['error'].get('message', '')}",
                error_data=data["error"],
            )
        start_offset = int(data["start_offset"])
        end_offset = int(data["end_offset"])

    # --- Phase 3: finish ---
    resp = requests.post(url, data={
        "access_token": token,
        "upload_phase": "finish",
        "upload_session_id": upload_session_id,
    }, timeout=60)
    data = resp.json()
    if "error" in data:
        raise MetaAPIError(
            f"Resumable upload finish failed: {data['error'].get('message', '')}",
            error_data=data["error"],
        )

    logger.info(f"Resumable upload complete: video_id={video_id}")
    return video_id


def upload_video_to_meta(account_id: str, video_bytes: bytes, filename: str,
                          token: str, file_url: str = None,
                          drive_url: str = None) -> str:
    """Upload video to Meta ad account. Returns video_id.

    Fallback chain:
      1. file_url (Meta downloads from URL directly — best for large files)
      2. source multipart upload
      3. resumable upload (for 413 / very large files)

    If file_url fails with error code 351, 389, or 413 and drive_url is provided,
    the file is downloaded from Drive and retried via source multipart, then
    resumable upload if multipart also fails with 413.
    """
    endpoint = f"{account_id}/advideos"
    url = f"{GRAPH_API_BASE}/{endpoint}"

    _FILE_URL_RETRY_CODES = {351, 389, 413}

    def _parse_response(resp):
        """Parse upload response, return (data, error_code|None)."""
        if resp.status_code != 200:
            logger.error(f"Video upload HTTP {resp.status_code}: {resp.text[:500]}")
            raise MetaAPIError(f"Video upload failed: HTTP {resp.status_code}")
        try:
            data = resp.json()
        except Exception:
            logger.error(f"Video upload non-JSON response ({len(resp.content)} bytes): {resp.text[:200]}")
            raise MetaAPIError(f"Video upload failed: non-JSON response (status={resp.status_code})")
        if "error" in data:
            code = data["error"].get("code")
            return data, code
        return data, None

    # --- Method 1: file_url ---
    if file_url:
        logger.info(f"Uploading via file_url to {account_id}: {filename}")
        resp = requests.post(url, data={
            "access_token": token,
            "file_url": file_url,
        }, timeout=120)
        data, err_code = _parse_response(resp)

        if err_code is None:
            video_id = data.get("id")
            logger.info(f"Video uploaded (file_url): video_id={video_id}")
            return video_id

        # file_url failed — decide whether to retry via download
        if err_code in _FILE_URL_RETRY_CODES and drive_url:
            logger.warning(
                f"file_url failed (code={err_code}), falling back to Drive download + multipart"
            )
            video_bytes, filename = download_from_drive(drive_url)
        else:
            raise MetaAPIError(
                f"Video upload failed: {data['error'].get('message', '')}",
                error_data=data["error"],
            )

    # --- Method 2: source multipart upload ---
    if video_bytes:
        logger.info(f"Uploading via source to {account_id}: {filename} ({len(video_bytes)} bytes)")
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as f:
                resp = requests.post(
                    url,
                    data={"access_token": token},
                    files={"source": (filename, f, "video/mp4")},
                    timeout=600,
                )
        finally:
            os.unlink(tmp_path)

        data, err_code = _parse_response(resp)

        if err_code is None:
            video_id = data.get("id")
            logger.info(f"Video uploaded (source): video_id={video_id}")
            return video_id

        # Multipart failed — try resumable only for 413
        if err_code == 413:
            logger.warning("Source multipart failed (413), falling back to resumable upload")
            return _resumable_upload(account_id, video_bytes, filename, token)

        raise MetaAPIError(
            f"Video upload failed: {data['error'].get('message', '')}",
            error_data=data["error"],
        )

    raise MetaAPIError("Video upload failed: no file_url and no video_bytes provided")


def get_video_thumbnail(video_id: str, token: str) -> str:
    """Get video thumbnail URL from Meta API. Waits for video to be ready."""
    import time
    for attempt in range(10):
        url = f"{GRAPH_API_BASE}/{video_id}"
        resp = requests.get(url, params={
            "access_token": token,
            "fields": "status,picture,thumbnails",
        }, timeout=30)
        data = resp.json()
        status = data.get("status", {})
        if isinstance(status, dict):
            video_status = status.get("video_status", "")
        else:
            video_status = str(status)

        if video_status == "ready":
            # Prefer thumbnails.data[0].uri, fallback to picture
            thumbnails = data.get("thumbnails", {}).get("data", [])
            if thumbnails:
                return thumbnails[0].get("uri", "")
            return data.get("picture", "")

        logger.info(f"Video {video_id} status: {video_status}, waiting... (attempt {attempt+1})")
        time.sleep(5)

    # Last resort: return picture even if not "ready"
    return data.get("picture", "")


# ---- Campaign creation ----

def create_campaign(account_id: str, campaign_data: dict, token: str,
                    dry_run: bool = False) -> str:
    """Create a Meta campaign. Returns meta_campaign_id."""
    params = {
        "name": campaign_data["campaign_name"],
        "objective": campaign_data["objective"],
        "status": campaign_data.get("status", "PAUSED"),
        "special_ad_categories": "[]",
    }

    # is_adset_budget_sharing_enabled (required by Meta API)
    # CBO (campaign budget): is_adset_budget_sharing_enabled=false, budget at campaign level
    # Adset budget sharing (Advantage): is_adset_budget_sharing_enabled=true, NO campaign budget
    is_cbo = campaign_data.get("is_cbo", True)
    is_budget_sharing = campaign_data.get("is_adset_budget_sharing", False)
    params["is_adset_budget_sharing_enabled"] = is_budget_sharing

    # CBO (Campaign Budget Optimization) — bid_strategy + budget at campaign level
    if is_cbo:
        bid_strategy = campaign_data.get("bid_strategy", "")
        if bid_strategy:
            params["bid_strategy"] = bid_strategy
        if campaign_data.get("daily_budget"):
            # JPY: no decimal subdivision, send as-is (e.g. 5000 = 5000円)
            params["daily_budget"] = int(float(campaign_data["daily_budget"]))

    # ASC (Advantage+ Shopping Campaign)
    if campaign_data.get("is_asc"):
        params["smart_promotion_type"] = "GUIDED_CREATION"

    if dry_run:
        logger.info(f"[DRY RUN] Would create campaign: {json.dumps(params, ensure_ascii=False, indent=2)}")
        return "dry_run_campaign_id"

    result = meta_api_post(f"{account_id}/campaigns", params, token)
    campaign_id = result["id"]
    logger.info(f"Created campaign: {campaign_id} ({campaign_data['campaign_name']})")
    return campaign_id


# ---- Adset creation ----

def create_adset(account_id: str, adset_data: dict, meta_campaign_id: str,
                 assets: dict, token: str, is_cbo: bool = True,
                 dry_run: bool = False) -> str:
    """Create a Meta adset. Returns meta_adset_id."""
    params = {
        "campaign_id": meta_campaign_id,
        "name": adset_data["adset_name"],
        "optimization_goal": adset_data["optimization_goal"],
        "billing_event": "IMPRESSIONS",
        "status": "PAUSED" if adset_data.get("status") in ("draft", "PAUSED", None) else adset_data["status"],
    }

    # Budget (adset level only if not CBO)
    if not is_cbo and adset_data.get("daily_budget"):
        # JPY: no decimal subdivision, send as-is (e.g. 5000 = 5000円)
        params["daily_budget"] = int(float(adset_data["daily_budget"]))

    # Bid amount
    if adset_data.get("bid_amount"):
        # JPY: send as-is
        params["bid_amount"] = int(float(adset_data["bid_amount"]))

    # Bid strategy at adset level (only for non-CBO; CBO has it at campaign level)
    if not is_cbo:
        bid_strategy = adset_data.get("bid_strategy") or "LOWEST_COST_WITHOUT_CAP"
        params["bid_strategy"] = bid_strategy

    # Promoted object (pixel + event)
    pixel = assets.get("pixel")
    if pixel and adset_data.get("promoted_pixel_id"):
        promoted_object = {"pixel_id": adset_data["promoted_pixel_id"]}
        custom_event = adset_data.get("promoted_custom_event") or "PURCHASE"
        # Convert "offsite_conversion.fb_pixel_xxx" format to Meta API format "XXX"
        if custom_event.startswith("offsite_conversion.fb_pixel_"):
            custom_event = custom_event.replace("offsite_conversion.fb_pixel_", "").upper()
        promoted_object["custom_event_type"] = custom_event
        params["promoted_object"] = json.dumps(promoted_object)

    # Targeting
    targeting = {}

    # Gender: 0=all, 1=male, 2=female
    gender = adset_data.get("gender", 0)
    if gender and gender != 0:
        targeting["genders"] = [gender]

    # Age
    age_min = adset_data.get("age_min", 18)
    age_max = adset_data.get("age_max", 65)
    if age_min:
        targeting["age_min"] = age_min
    if age_max:
        targeting["age_max"] = age_max

    # Geo targeting (default: Japan)
    geo = adset_data.get("geo_locations")
    if geo:
        geo_dict = geo if isinstance(geo, dict) else json.loads(geo)
        targeting["geo_locations"] = geo_dict
    else:
        targeting["geo_locations"] = {"countries": ["JP"]}

    # Language targeting (default: Japanese, key=11)
    locales = adset_data.get("locales")
    if locales:
        targeting["locales"] = locales if isinstance(locales, list) else json.loads(locales)
    else:
        targeting["locales"] = [11]  # 日本語

    # Custom audiences
    include_audiences = adset_data.get("include_custom_audiences", [])
    if include_audiences:
        if isinstance(include_audiences, str):
            include_audiences = json.loads(include_audiences)
        if include_audiences:
            targeting["custom_audiences"] = [
                {"id": aud["id"]} for aud in include_audiences
            ]

    exclude_audiences = adset_data.get("exclude_custom_audiences", [])
    if exclude_audiences:
        if isinstance(exclude_audiences, str):
            exclude_audiences = json.loads(exclude_audiences)
        if exclude_audiences:
            targeting["excluded_custom_audiences"] = [
                {"id": aud["id"]} for aud in exclude_audiences
            ]

    # Disable Advantage+ audience (always use manual targeting)
    targeting["targeting_automation"] = {"advantage_audience": 0}

    if targeting:
        params["targeting"] = json.dumps(targeting)

    # Placement
    placement = adset_data.get("placement_config")
    if placement:
        if isinstance(placement, str):
            placement = json.loads(placement)
        if placement.get("is_advantage_plus"):
            # Advantage+ placements: no publisher_platforms needed
            pass
        elif placement.get("publisher_platforms"):
            params["targeting"] = json.dumps({
                **json.loads(params.get("targeting", "{}")),
                "publisher_platforms": placement["publisher_platforms"],
                **({"facebook_positions": placement["facebook_positions"]}
                   if placement.get("facebook_positions") else {}),
                **({"instagram_positions": placement["instagram_positions"]}
                   if placement.get("instagram_positions") else {}),
            })

    # Start time (default: next day 00:00 JST)
    if adset_data.get("start_time"):
        params["start_time"] = adset_data["start_time"]
    else:
        from datetime import timedelta
        from zoneinfo import ZoneInfo
        jst = ZoneInfo("Asia/Tokyo")
        tomorrow = datetime.now(jst).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        params["start_time"] = tomorrow.isoformat()

    # Attribution: default click 1 day only
    attribution = adset_data.get("attribution_spec")
    if attribution:
        params["attribution_spec"] = json.dumps(attribution) if not isinstance(attribution, str) else attribution
    else:
        params["attribution_spec"] = json.dumps([
            {"event_type": "CLICK_THROUGH", "window_days": 1}
        ])

    # Rules / Value rules
    if adset_data.get("rule_id"):
        params["contextual_bundling_spec"] = json.dumps({"status": "OPT_IN"})
    if adset_data.get("value_rule_id"):
        params["value_rule_set_id"] = str(adset_data["value_rule_id"])

    if dry_run:
        logger.info(f"[DRY RUN] Would create adset: {json.dumps(params, ensure_ascii=False, indent=2)}")
        return "dry_run_adset_id"

    result = meta_api_post(f"{account_id}/adsets", params, token)
    adset_id = result["id"]
    logger.info(f"Created adset: {adset_id} ({adset_data['adset_name']})")
    return adset_id


# ---- Ad creative + Ad creation ----

def create_ad_creative(account_id: str, ad_data: dict, video_id: str,
                        assets: dict, token: str, dry_run: bool = False) -> str:
    """Create an ad creative with video. Returns meta_creative_id."""
    page = assets.get("facebook_page", {})
    page_id = ad_data.get("page_id") or page.get("meta_asset_id")

    if not page_id:
        raise ValueError("No Facebook page ID available for ad creative")

    # Get video thumbnail URL for video_data
    thumbnail_url = ""
    if not dry_run:
        thumbnail_url = get_video_thumbnail(video_id, token)
        logger.info(f"Video thumbnail: {thumbnail_url[:80]}..." if thumbnail_url else "No thumbnail")

    # Video creative spec
    video_data = {
        "video_id": video_id,
        "title": ad_data.get("title", ""),
        "message": ad_data.get("body", ""),
        "link_description": ad_data.get("description", ""),
        "call_to_action": {
            "type": "LEARN_MORE",
            "value": {"link": ad_data.get("link_url", "")},
        },
    }

    # Add thumbnail (required by Meta API for video ads)
    if thumbnail_url:
        video_data["image_url"] = thumbnail_url

    # URL parameters
    if ad_data.get("url_parameters"):
        link = ad_data.get("link_url", "")
        sep = "&" if "?" in link else "?"
        video_data["call_to_action"]["value"]["link"] = f"{link}{sep}{ad_data['url_parameters']}"

    object_story_spec = {
        "page_id": page_id,
        "video_data": video_data,
    }

    # Instagram actor ID: only use if explicitly set (no guessing)
    ig_id = ad_data.get("instagram_actor_id") or assets.get("instagram_account", {}).get("meta_asset_id")

    params = {
        "name": f"CR_{ad_data['ad_name']}",
        # Creative enhancements ALL OFF
        **{k: json.dumps(v) if isinstance(v, dict) else v
           for k, v in CREATIVE_ENHANCEMENTS_OFF.items()},
    }

    if dry_run:
        if ig_id:
            object_story_spec["instagram_actor_id"] = ig_id
        params["object_story_spec"] = json.dumps(object_story_spec)
        logger.info(f"[DRY RUN] Would create creative: {json.dumps(params, ensure_ascii=False, indent=2)}")
        return "dry_run_creative_id"

    # First attempt: with instagram_actor_id
    if ig_id:
        object_story_spec["instagram_actor_id"] = ig_id
        params["object_story_spec"] = json.dumps(object_story_spec)
        try:
            result = meta_api_post(f"{account_id}/adcreatives", params, token)
            creative_id = result["id"]
            logger.info(f"Created creative: {creative_id}")
            return creative_id
        except MetaAPIError as e:
            if "instagram_actor_id" in str(e).lower() or "instagram" in str(e).lower():
                logger.warning(f"instagram_actor_id failed, retrying without: {e}")
                del object_story_spec["instagram_actor_id"]
            else:
                raise

    # Second attempt (or first if no ig_id): without instagram_actor_id
    params["object_story_spec"] = json.dumps(object_story_spec)
    logger.info(f"Creative params (no IG): {json.dumps({k: v[:200] if isinstance(v, str) and len(v) > 200 else v for k, v in params.items() if k != 'access_token'}, ensure_ascii=False)}")
    result = meta_api_post(f"{account_id}/adcreatives", params, token)
    creative_id = result["id"]
    logger.info(f"Created creative: {creative_id}")
    return creative_id


def create_ad(account_id: str, ad_data: dict, meta_adset_id: str,
              meta_creative_id: str, token: str, dry_run: bool = False) -> str:
    """Create an ad. Returns meta_ad_id."""
    params = {
        "name": ad_data["ad_name"],
        "adset_id": meta_adset_id,
        "creative": json.dumps({"creative_id": meta_creative_id}),
        "status": "PAUSED" if ad_data.get("status") in ("draft", "PAUSED", None) else ad_data["status"],
        # Note: multi_advertiser is now controlled at creative level via contextual_multi_ads
        # Personalized destination: always OFF
        "is_advantaged_destination_enabled": "false",
    }

    if dry_run:
        logger.info(f"[DRY RUN] Would create ad: {json.dumps(params, ensure_ascii=False, indent=2)}")
        return "dry_run_ad_id"

    result = meta_api_post(f"{account_id}/ads", params, token)
    ad_id = result["id"]
    logger.info(f"Created ad: {ad_id} ({ad_data['ad_name']})")
    return ad_id


# ---- Main submission flow ----

def submit(submission_id: int, dry_run: bool = False):
    """Execute full submission flow for a given submission_id."""
    client = get_client()
    token = get_access_token()
    google_api_key = os.getenv("GOOGLE_API_KEY")

    # 1. Load submission data
    logger.info(f"Loading submission {submission_id}...")
    submission = load_submission(client, submission_id)

    if submission["status"] not in ("draft", "validated", "error"):
        raise ValueError(
            f"Submission {submission_id} has status '{submission['status']}' — "
            "only draft/validated/error can be submitted"
        )

    account_id = submission["account_id"]
    campaigns = submission.get("campaigns", [])

    if not campaigns:
        raise ValueError(f"Submission {submission_id} has no campaigns")

    # 2. Load assets (FB page, pixel, IG)
    assets = load_account_assets(client, submission)
    logger.info(f"Assets: page={assets.get('facebook_page', {}).get('asset_name')}, "
                f"pixel={assets.get('pixel', {}).get('asset_name')}")

    # 3. Update status to submitting
    if not dry_run:
        update_submission_status(client, submission_id, "submitting")

    has_error = False
    total_ads = 0

    try:
        for camp in campaigns:
            # Skip already submitted campaigns
            if camp.get("meta_campaign_id"):
                logger.info(f"Campaign {camp['id']} already submitted, skipping")
                meta_campaign_id = camp["meta_campaign_id"]
            else:
                # Create campaign
                try:
                    meta_campaign_id = create_campaign(
                        account_id, camp, token, dry_run=dry_run
                    )
                    if not dry_run:
                        client.table("submission_campaigns").update(
                            {"meta_campaign_id": meta_campaign_id}
                        ).eq("id", camp["id"]).execute()
                        # Also upsert to fetcher campaigns table
                        try:
                            client.table("campaigns").upsert({
                                "campaign_id": meta_campaign_id,
                                "campaign_name": camp["campaign_name"],
                                "account_id": account_id,
                            }, on_conflict="campaign_id").execute()
                        except Exception as camp_err:
                            logger.warning(f"campaigns table write-back failed (non-fatal): {camp_err}")
                except MetaAPIError as e:
                    logger.error(f"Campaign creation failed: {e}")
                    if not dry_run:
                        client.table("submission_campaigns").update(
                            {"error_message": str(e)}
                        ).eq("id", camp["id"]).execute()
                    has_error = True
                    continue

            for adset in camp.get("adsets", []):
                if adset.get("meta_adset_id"):
                    logger.info(f"Adset {adset['id']} already submitted, skipping")
                    meta_adset_id = adset["meta_adset_id"]
                else:
                    try:
                        meta_adset_id = create_adset(
                            account_id, adset, meta_campaign_id, assets,
                            token, is_cbo=camp.get("is_cbo", True),
                            dry_run=dry_run
                        )
                        if not dry_run:
                            client.table("submission_adsets").update(
                                {"meta_adset_id": meta_adset_id}
                            ).eq("id", adset["id"]).execute()
                            # Also upsert to fetcher adsets table
                            try:
                                client.table("adsets").upsert({
                                    "adset_id": meta_adset_id,
                                    "adset_name": adset["adset_name"],
                                    "campaign_id": meta_campaign_id,
                                    "account_id": account_id,
                                }, on_conflict="adset_id").execute()
                            except Exception as adsets_err:
                                logger.warning(f"adsets table write-back failed (non-fatal): {adsets_err}")
                    except MetaAPIError as e:
                        logger.error(f"Adset creation failed: {e}")
                        if not dry_run:
                            client.table("submission_adsets").update(
                                {"error_message": str(e)}
                            ).eq("id", adset["id"]).execute()
                        has_error = True
                        continue

                for ad in adset.get("ads", []):
                    if ad.get("meta_ad_id"):
                        logger.info(f"Ad {ad['id']} already submitted, skipping")
                        total_ads += 1
                        continue

                    try:
                        # Download video from Drive and upload to Meta
                        video_id = None
                        if dry_run:
                            if ad.get("drive_url"):
                                logger.info(f"[DRY RUN] Would download from Drive: {ad['drive_url']}")
                            else:
                                logger.warning(f"[DRY RUN] No drive_url for ad '{ad['ad_name']}'")
                            video_id = "dry_run_video_id"
                        elif ad.get("drive_url"):
                            # Check for cached video_id in creatives.meta_video_ids
                            creative_id = ad.get("creative_id")
                            cached_video_id = None
                            if creative_id:
                                cr_row = client.table("creatives").select("meta_video_ids").eq("id", creative_id).limit(1).execute()
                                if cr_row.data:
                                    vid_map = cr_row.data[0].get("meta_video_ids") or {}
                                    cached_video_id = vid_map.get(account_id)

                            if cached_video_id:
                                video_id = cached_video_id
                                logger.info(f"Using cached video_id: {video_id} (from creatives.meta_video_ids)")
                            else:
                                # Prefer file_url method (Meta downloads directly, avoids 413)
                                direct_url = get_drive_direct_url(ad["drive_url"])
                                filename = extract_drive_file_id(ad["drive_url"]) + ".mp4"
                                video_id = upload_video_to_meta(
                                    account_id, b"", filename, token,
                                    file_url=direct_url,
                                    drive_url=ad["drive_url"],
                                )
                                # Cache video_id in creatives.meta_video_ids
                                if creative_id:
                                    try:
                                        cr_row = client.table("creatives").select("meta_video_ids").eq("id", creative_id).limit(1).execute()
                                        existing = (cr_row.data[0].get("meta_video_ids") or {}) if cr_row.data else {}
                                        existing[account_id] = video_id
                                        client.table("creatives").update({"meta_video_ids": existing}).eq("id", creative_id).execute()
                                    except Exception as cache_err:
                                        logger.warning(f"Failed to cache video_id: {cache_err}")

                        if not video_id:
                            raise ValueError(f"No video for ad '{ad['ad_name']}' — drive_url is required")

                        # Create creative
                        meta_creative_id = create_ad_creative(
                            account_id, ad, video_id, assets, token, dry_run=dry_run
                        )

                        # Create ad
                        meta_ad_id = create_ad(
                            account_id, ad, meta_adset_id, meta_creative_id,
                            token, dry_run=dry_run
                        )

                        if not dry_run:
                            client.table("submission_ads").update({
                                "meta_ad_id": meta_ad_id,
                                "meta_creative_id": meta_creative_id,
                            }).eq("id", ad["id"]).execute()

                            # Write-back to ads table: creative_id + cats_content_id
                            ads_update = {"creative_id": ad.get("creative_id")}
                            # cats_content_id: 優先1=submission_ads直接, 優先2=redirect_urlマッチ
                            if ad.get("cats_content_id"):
                                ads_update["cats_content_id"] = ad["cats_content_id"]
                            else:
                                link_url = ad.get("link_url", "")
                                if link_url:
                                    cats_match = (client.table("cats_contents")
                                                  .select("cats_content_id")
                                                  .eq("redirect_url", link_url)
                                                  .limit(1)
                                                  .execute())
                                    if cats_match.data:
                                        ads_update["cats_content_id"] = cats_match.data[0]["cats_content_id"]

                            # upsert to ads (fetcher may have already created the row)
                            try:
                                client.table("ads").upsert({
                                    "ad_id": meta_ad_id,
                                    "ad_name": ad["ad_name"],
                                    "adset_id": meta_adset_id,
                                    **ads_update,
                                }, on_conflict="ad_id").execute()
                            except Exception as ads_err:
                                logger.warning(f"ads table write-back failed (non-fatal): {ads_err}")

                        total_ads += 1

                    except (MetaAPIError, ValueError) as e:
                        logger.error(f"Ad creation failed for '{ad['ad_name']}': {e}")
                        if not dry_run:
                            client.table("submission_ads").update(
                                {"error_message": str(e)}
                            ).eq("id", ad["id"]).execute()
                        has_error = True

        # 4. Final status
        if not dry_run:
            if has_error and total_ads > 0:
                update_submission_status(client, submission_id, "partial_error")
            elif has_error:
                update_submission_status(client, submission_id, "error",
                                         "All items failed — check individual error messages")
            else:
                update_submission_status(client, submission_id, "completed")

        logger.info(f"Submission {submission_id} done: {total_ads} ads created, errors={has_error}")

    except Exception as e:
        logger.error(f"Submission {submission_id} failed: {e}")
        if not dry_run:
            update_submission_status(client, submission_id, "error", str(e))
        raise

    return {"submission_id": submission_id, "ads_created": total_ads, "has_error": has_error}


# ---- CLI ----

def main():
    parser = argparse.ArgumentParser(description="Meta Ads Submission Engine")
    parser.add_argument("submission_id", type=int, help="Submission ID to process")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be created without calling Meta API")
    args = parser.parse_args()

    result = submit(args.submission_id, dry_run=args.dry_run)
    print(f"\nResult: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    main()
