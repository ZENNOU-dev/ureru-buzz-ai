"""TikTok入稿エンジン - DB→TikTok API→ID書き戻し

Meta版 submission_engine.py と対称的な構造:
  load_tiktok_submission(submission_id)
  submit_tiktok(submission_id, dry_run=False)

使い方:
  python tiktok_submission_engine.py 1          # 本番入稿
  python tiktok_submission_engine.py 1 --dry-run # API呼び出しなし確認
"""

import argparse
import json
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
load_dotenv()

from database import get_client
from tiktok_ad_manager import (
    create_campaign,
    create_adgroup,
    create_ad,
    upload_video_by_url,
)
from tiktok_auth import TikTokAPIError

logger = logging.getLogger(__name__)
JST = ZoneInfo("Asia/Tokyo")


# ---- Helpers ----

def get_drive_direct_url(drive_url: str) -> str:
    """Google Drive共有URLをfile_url方式用に変換."""
    file_id = extract_drive_file_id(drive_url)
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def extract_drive_file_id(url: str) -> str:
    """Drive URLからファイルIDを抽出."""
    if "/d/" in url:
        return url.split("/d/")[1].split("/")[0].split("?")[0]
    if "id=" in url:
        return url.split("id=")[1].split("&")[0]
    return url


# ---- Load ----

def load_tiktok_submission(client, submission_id: int) -> dict:
    """tiktok_submissions + campaigns + adgroups + ads を再帰ロード."""
    sub = client.table("tiktok_submissions").select("*").eq("id", submission_id).single().execute()
    submission = sub.data

    camps = client.table("tiktok_sub_campaigns").select("*").eq("submission_id", submission_id).execute()
    submission["campaigns"] = camps.data

    for camp in submission["campaigns"]:
        adgroups = client.table("tiktok_sub_adgroups").select("*").eq("campaign_id", camp["id"]).execute()
        camp["adgroups"] = adgroups.data

        for ag in camp["adgroups"]:
            ads = client.table("tiktok_sub_ads").select("*").eq("adgroup_id", ag["id"]).execute()
            ag["ads"] = ads.data

    return submission


def update_submission_status(client, submission_id: int, status: str, error_msg: str = None):
    """tiktok_submissions.status を更新."""
    data = {"status": status}
    if status == "completed":
        data["submitted_at"] = datetime.now(JST).isoformat()
    if error_msg:
        data["error_message"] = error_msg
    client.table("tiktok_submissions").update(data).eq("id", submission_id).execute()


# ---- Video upload with cache ----

def upload_video_for_creative(
    client,
    advertiser_id: str,
    creative_id: int | None,
    drive_url: str,
    creative_name: str,
    dry_run: bool = False,
) -> str:
    """動画をアップロードし、creatives.tiktok_video_ids にキャッシュ.

    Returns: TikTok video_id
    """
    if dry_run:
        logger.info(f"[DRY RUN] Would upload video: {drive_url} as '{creative_name}'")
        return "dry_run_video_id"

    # Check cache
    cached_video_id = None
    if creative_id:
        cr_row = client.table("creatives").select("tiktok_video_ids").eq("id", creative_id).limit(1).execute()
        if cr_row.data:
            vid_map = cr_row.data[0].get("tiktok_video_ids") or {}
            cached_video_id = vid_map.get(advertiser_id)

    if cached_video_id:
        logger.info(f"Using cached TikTok video_id: {cached_video_id} for CR '{creative_name}'")
        return cached_video_id

    # Upload by URL
    direct_url = get_drive_direct_url(drive_url)
    result = upload_video_by_url(
        advertiser_id=advertiser_id,
        video_url=direct_url,
        file_name=f"{creative_name}.mp4",  # CR名で設定 → 管理画面で識別可能
    )
    video_id = result.get("video_id")
    logger.info(f"Uploaded video to TikTok: {video_id} (CR: {creative_name})")

    # Cache
    if creative_id and video_id:
        try:
            cr_row = client.table("creatives").select("tiktok_video_ids").eq("id", creative_id).limit(1).execute()
            existing = (cr_row.data[0].get("tiktok_video_ids") or {}) if cr_row.data else {}
            existing[advertiser_id] = video_id
            client.table("creatives").update({"tiktok_video_ids": existing}).eq("id", creative_id).execute()
        except Exception as cache_err:
            logger.warning(f"Failed to cache TikTok video_id: {cache_err}")

    return video_id


# ---- Main submission flow ----

def submit_tiktok(submission_id: int, dry_run: bool = False):
    """TikTok入稿フロー全体を実行.

    1. Campaign作成 → tiktok_campaign_id 書き戻し
    2. Adgroup作成 → tiktok_adgroup_id 書き戻し
    3. 動画アップロード (CR単位キャッシュ)
    4. Ad作成 → tiktok_ad_id 書き戻し
    5. Fetcher テーブルに書き戻し
    """
    client = get_client()

    # 1. Load
    logger.info(f"Loading TikTok submission {submission_id}...")
    submission = load_tiktok_submission(client, submission_id)

    if submission["status"] not in ("draft", "validated", "error"):
        raise ValueError(
            f"TikTok submission {submission_id} has status '{submission['status']}' — "
            "only draft/validated/error can be submitted"
        )

    advertiser_id = submission["account_id"]
    campaign_type = submission.get("campaign_type", "manual")
    campaigns = submission.get("campaigns", [])

    if not campaigns:
        raise ValueError(f"TikTok submission {submission_id} has no campaigns")

    # 2. Update status
    if not dry_run:
        update_submission_status(client, submission_id, "submitting")

    has_error = False
    total_ads = 0

    try:
        for camp in campaigns:
            # --- Campaign ---
            if camp.get("tiktok_campaign_id"):
                logger.info(f"Campaign {camp['id']} already submitted, skipping")
                tiktok_campaign_id = camp["tiktok_campaign_id"]
            else:
                try:
                    automation_type = camp.get("campaign_automation_type", "MANUAL")

                    result = create_campaign(
                        advertiser_id=advertiser_id,
                        campaign_name=camp["campaign_name"],
                        objective_type=camp.get("objective_type", "WEB_CONVERSIONS"),
                        budget_mode=camp.get("budget_mode", "BUDGET_MODE_DYNAMIC_DAILY_BUDGET"),
                        budget=float(camp["budget"]) if camp.get("budget") else None,
                        campaign_automation_type=automation_type,
                    ) if not dry_run else {"campaign_id": "dry_run_campaign"}

                    tiktok_campaign_id = result.get("campaign_id", "dry_run_campaign")
                    logger.info(f"Created TikTok campaign: {tiktok_campaign_id}")

                    if not dry_run:
                        client.table("tiktok_sub_campaigns").update(
                            {"tiktok_campaign_id": tiktok_campaign_id}
                        ).eq("id", camp["id"]).execute()

                        # Fetcher書き戻し
                        try:
                            client.table("tiktok_campaigns").upsert({
                                "campaign_id": tiktok_campaign_id,
                                "campaign_name": camp["campaign_name"],
                                "account_id": advertiser_id,
                                "objective_type": camp.get("objective_type", "CONVERSIONS"),
                                "budget_mode": camp.get("budget_mode"),
                                "budget": float(camp["budget"]) if camp.get("budget") else None,
                                "status": camp.get("status", "DISABLE"),
                            }, on_conflict="campaign_id").execute()
                        except Exception as e:
                            logger.warning(f"tiktok_campaigns write-back failed (non-fatal): {e}")

                except TikTokAPIError as e:
                    logger.error(f"Campaign creation failed: {e}")
                    if not dry_run:
                        client.table("tiktok_sub_campaigns").update(
                            {"error_message": str(e)}
                        ).eq("id", camp["id"]).execute()
                    has_error = True
                    continue

            # --- Adgroup ---
            for ag in camp.get("adgroups", []):
                if ag.get("tiktok_adgroup_id"):
                    logger.info(f"Adgroup {ag['id']} already submitted, skipping")
                    tiktok_adgroup_id = ag["tiktok_adgroup_id"]
                else:
                    try:
                        adgroup_kwargs = {
                            "advertiser_id": advertiser_id,
                            "campaign_id": tiktok_campaign_id,
                            "adgroup_name": ag["adgroup_name"],
                            "placement_type": ag.get("placement_type", "PLACEMENT_TYPE_NORMAL"),
                            "optimize_goal": ag.get("optimize_goal", "CONVERT"),
                            "bid_type": ag.get("bid_type", "BID_TYPE_NO_BID"),
                            "billing_event": ag.get("billing_event", "OCPM"),
                            "location_ids": ag.get("location_ids", [1850144, 1860291, 2113014, 1853226]),
                            "languages": ag.get("languages", ["ja"]),
                            "pixel_id": ag.get("pixel_id"),
                            "optimization_event": ag.get("optimization_event", "SHOPPING"),
                            "comment_disabled": ag.get("comment_disabled", True),
                            "video_download_disabled": ag.get("video_download_disabled", True),
                            "share_disabled": ag.get("share_disabled", True),
                            "attribution_click_window": ag.get("attribution_click_window", "ONE_DAY"),
                            "attribution_view_window": ag.get("attribution_view_window", "DISABLED"),
                            "event_counting": ag.get("event_counting", "UNIQUE"),
                            "promotion_type": ag.get("promotion_type", "WEBSITE"),
                            "search_result_enabled": ag.get("search_result_enabled", True),
                            "skip_learning_phase": ag.get("skip_learning_phase", True),
                            "schedule_type": ag.get("schedule_type", "SCHEDULE_FROM_NOW"),
                        }

                        # Budget (非CBO時のみ)
                        if ag.get("budget"):
                            adgroup_kwargs["budget"] = float(ag["budget"])
                            adgroup_kwargs["budget_mode"] = ag.get("budget_mode", "BUDGET_MODE_DYNAMIC_DAILY_BUDGET")

                        # Bid amount (tCPA)
                        if ag.get("bid_amount"):
                            adgroup_kwargs["bid_amount"] = float(ag["bid_amount"])

                        # Gender / Age
                        if ag.get("gender"):
                            adgroup_kwargs["gender"] = ag["gender"]
                        if ag.get("age_groups"):
                            adgroup_kwargs["age_groups"] = ag["age_groups"]

                        # Placements (手動のみ)
                        if ag.get("placements"):
                            adgroup_kwargs["placements"] = ag["placements"]

                        # Audiences
                        if ag.get("custom_audiences"):
                            adgroup_kwargs["custom_audiences"] = ag["custom_audiences"]
                        if ag.get("audience_suggestion"):
                            adgroup_kwargs["audience_suggestion"] = ag["audience_suggestion"]

                        if dry_run:
                            logger.info(f"[DRY RUN] Would create adgroup: {ag['adgroup_name']}")
                            tiktok_adgroup_id = "dry_run_adgroup"
                        else:
                            result = create_adgroup(**adgroup_kwargs)
                            tiktok_adgroup_id = result.get("adgroup_id")
                            logger.info(f"Created TikTok adgroup: {tiktok_adgroup_id}")

                            client.table("tiktok_sub_adgroups").update(
                                {"tiktok_adgroup_id": tiktok_adgroup_id}
                            ).eq("id", ag["id"]).execute()

                            # Fetcher書き戻し
                            try:
                                client.table("tiktok_adgroups").upsert({
                                    "adgroup_id": tiktok_adgroup_id,
                                    "adgroup_name": ag["adgroup_name"],
                                    "campaign_id": tiktok_campaign_id,
                                    "placement_type": ag.get("placement_type"),
                                    "optimize_goal": ag.get("optimize_goal"),
                                    "bid_type": ag.get("bid_type"),
                                    "status": ag.get("status", "ENABLE"),
                                }, on_conflict="adgroup_id").execute()
                            except Exception as e:
                                logger.warning(f"tiktok_adgroups write-back failed (non-fatal): {e}")

                    except TikTokAPIError as e:
                        logger.error(f"Adgroup creation failed: {e}")
                        if not dry_run:
                            client.table("tiktok_sub_adgroups").update(
                                {"error_message": str(e)}
                            ).eq("id", ag["id"]).execute()
                        has_error = True
                        continue

                # --- Ads ---
                for ad in ag.get("ads", []):
                    if ad.get("tiktok_ad_id"):
                        logger.info(f"Ad {ad['id']} already submitted, skipping")
                        total_ads += 1
                        continue

                    try:
                        # Upload videos for this ad
                        creative_ids = ad.get("creative_ids", [])
                        uploaded_video_ids = []

                        for cr_id in creative_ids:
                            # Get creative info
                            cr_row = client.table("creatives").select(
                                "id, creative_name, cr_url"
                            ).eq("id", cr_id).limit(1).execute()

                            if not cr_row.data:
                                raise ValueError(f"Creative ID {cr_id} not found in DB")

                            cr = cr_row.data[0]
                            drive_url = cr.get("cr_url")
                            if not drive_url:
                                raise ValueError(f"Creative '{cr['creative_name']}' has no cr_url (drive URL)")

                            vid = upload_video_for_creative(
                                client, advertiser_id, cr_id,
                                drive_url, cr["creative_name"],
                                dry_run=dry_run,
                            )
                            uploaded_video_ids.append(vid)

                        if not uploaded_video_ids:
                            raise ValueError(f"No videos for ad '{ad['ad_name']}'")

                        # Create ad
                        if dry_run:
                            logger.info(
                                f"[DRY RUN] Would create ad: {ad['ad_name']} "
                                f"with {len(uploaded_video_ids)} videos"
                            )
                            tiktok_ad_id = "dry_run_ad"
                        else:
                            result = create_ad(
                                advertiser_id=advertiser_id,
                                adgroup_id=tiktok_adgroup_id,
                                ad_name=ad["ad_name"],
                                video_ids=uploaded_video_ids,
                                ad_text=ad.get("ad_text", ""),
                                ad_format=ad.get("ad_format", "SINGLE_VIDEO"),
                                display_name=ad.get("display_name", ""),
                                call_to_action=ad.get("call_to_action", "LEARN_MORE"),
                                landing_page_url=ad.get("landing_page_url", ""),
                                identity_id=ad.get("identity_id"),
                                identity_type=ad.get("identity_type"),
                                auto_enhance_disabled=ad.get("auto_enhance_disabled", True),
                                interactive_addon_config=ad.get("interactive_addon_config"),
                            )

                            ad_ids = result.get("ad_ids", [])
                            tiktok_ad_id = ad_ids[0] if ad_ids else None
                            logger.info(f"Created TikTok ad: {tiktok_ad_id}")

                            # 書き戻し: tiktok_sub_ads
                            client.table("tiktok_sub_ads").update({
                                "tiktok_ad_id": tiktok_ad_id,
                                "tiktok_video_ids": uploaded_video_ids,
                            }).eq("id", ad["id"]).execute()

                            # Fetcher書き戻し: tiktok_ads
                            # 手動 = 1 ad per video, Smart+ = 1 ad with multiple videos
                            try:
                                for vid_id in uploaded_video_ids:
                                    # Smart+で複数adが作成された場合のハンドリング
                                    target_ad_id = tiktok_ad_id
                                    if len(ad_ids) > 1:
                                        idx = uploaded_video_ids.index(vid_id)
                                        target_ad_id = ad_ids[idx] if idx < len(ad_ids) else tiktok_ad_id

                                    client.table("tiktok_ads").upsert({
                                        "ad_id": target_ad_id,
                                        "ad_name": ad["ad_name"],
                                        "adgroup_id": tiktok_adgroup_id,
                                        "ad_format": ad.get("ad_format", "SINGLE_VIDEO"),
                                        "landing_page_url": ad.get("landing_page_url"),
                                        "video_id": vid_id,
                                        "status": ad.get("status", "ENABLE"),
                                    }, on_conflict="ad_id").execute()
                            except Exception as e:
                                logger.warning(f"tiktok_ads write-back failed (non-fatal): {e}")

                        total_ads += 1

                    except (TikTokAPIError, ValueError) as e:
                        logger.error(f"Ad creation failed for '{ad['ad_name']}': {e}")
                        if not dry_run:
                            client.table("tiktok_sub_ads").update(
                                {"error_message": str(e)}
                            ).eq("id", ad["id"]).execute()
                        has_error = True

        # Final status
        if not dry_run:
            if has_error and total_ads > 0:
                update_submission_status(client, submission_id, "partial_error")
            elif has_error:
                update_submission_status(client, submission_id, "error",
                                         "All items failed — check individual error messages")
            else:
                update_submission_status(client, submission_id, "completed")

        logger.info(f"TikTok submission {submission_id} done: {total_ads} ads, errors={has_error}")

    except Exception as e:
        logger.error(f"TikTok submission {submission_id} failed: {e}")
        if not dry_run:
            update_submission_status(client, submission_id, "error", str(e))
        raise

    return {"submission_id": submission_id, "ads_created": total_ads, "has_error": has_error}


# ---- CLI ----

def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="TikTok Ads Submission Engine")
    parser.add_argument("submission_id", type=int, help="TikTok submission ID to process")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be created without calling TikTok API")
    args = parser.parse_args()

    result = submit_tiktok(args.submission_id, dry_run=args.dry_run)
    print(f"\nResult: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    main()
