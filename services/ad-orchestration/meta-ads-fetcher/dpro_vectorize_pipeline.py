"""競合CR動画ベクトル化パイプライン (動画分析PRO).

DProから取得した競合CRの動画を:
  1. シーン分割 (ffmpeg)
  2. テロップ抽出 (Cloud Vision OCR)
  3. 音声書き起こし (Gemini Flash)
  4. ベクトル化 (Gemini Embedding 2)

処理フロー:
  DPro API → HTTP DL → ffprobe → scene detect → frame extract
  → Cloud Vision OCR → Gemini Flash 書き起こし → Gemini Embedding 2 → Supabase

既存の cr_vectorize_pipeline.py の関数を再利用。
"""

import argparse
import json
import logging
import os
import tempfile
import time

import requests
from dotenv import load_dotenv

load_dotenv()

from cr_vectorize_pipeline import (
    get_video_info,
    detect_scenes,
    extract_frame,
    ocr_frames_batch,
    transcribe_audio,
    embed_video,
    embed_text,
    embed_image,
    EMBEDDING_MODEL,
    ANALYSIS_MODEL,
    MAX_VIDEO_DURATION_SEC,
    SCENE_THRESHOLD,
)
from database import (
    get_client,
    upsert_dpro_items,
    get_dpro_item_by_dpro_id,
    upsert_dpro_video,
    upsert_dpro_scenes,
    update_dpro_video_fields,
    update_dpro_scene_fields,
    get_dpro_scenes,
)

import subprocess

logger = logging.getLogger(__name__)


# ============================================================
# Download from DPro production_url
# ============================================================

def download_dpro_video(url: str, timeout: int = 120) -> bytes:
    """Download video from DPro production_url with retry."""
    for attempt in range(3):
        try:
            resp = requests.get(url, timeout=timeout, stream=True)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.warning(f"Download attempt {attempt+1}/3 failed: {e}")
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
            else:
                raise


def dpro_item_to_row(item: dict) -> dict:
    """Convert DPro API item dict to dpro_items DB row."""
    streaming_period = item.get("streaming_period", "")
    period_days = None
    if streaming_period and "日" in str(streaming_period):
        try:
            period_days = int(str(streaming_period).replace("日", "").strip())
        except ValueError:
            pass

    return {
        "dpro_item_id": str(item["id"]),
        "product_id": str(item.get("product_id", "")),
        "product_name": item.get("product_name", ""),
        "genre_id": str(item.get("genre_id", "")),
        "genre_name": item.get("genre_name", ""),
        "advertiser_name": item.get("advertiser_name", ""),
        "app_name": item.get("app_name", ""),
        "app_id": str(item.get("app_id", "")),
        "production_url": item.get("production_url", ""),
        "thumbnail_url": item.get("thumbnail_url", ""),
        "transition_url": item.get("transition_url", ""),
        "media_type": item.get("media_type", ""),
        "video_shape": item.get("video_shape", ""),
        "ad_sentence": item.get("ad_sentence", ""),
        "ad_all_sentence": item.get("ad_all_sentence", ""),
        "narration": item.get("narration", ""),
        "cost": int(str(item["cost"]).replace(",", "")) if item.get("cost") else None,
        "cost_difference": int(str(item["cost_difference"]).replace(",", "")) if item.get("cost_difference") else None,
        "play_count": int(str(item["play_count"]).replace(",", "")) if item.get("play_count") else None,
        "digg_count": int(str(item["digg_count"]).replace(",", "")) if item.get("digg_count") else None,
        "creation_time": item.get("creation_time"),
        "streaming_period_days": period_days,
        "metadata": json.dumps({
            k: v for k, v in item.items()
            if k not in {
                "id", "product_id", "product_name", "genre_id", "genre_name",
                "advertiser_name", "app_name", "app_id", "production_url",
                "thumbnail_url", "transition_url", "media_type", "video_shape",
                "ad_sentence", "ad_all_sentence", "narration", "cost",
                "cost_difference", "play_count", "digg_count", "creation_time",
                "streaming_period",
            }
        }),
    }


# ============================================================
# Main pipeline
# ============================================================

def process_dpro_item(supabase_client, item: dict,
                      skip_embeddings: bool = False) -> bool:
    """Process a single DPro item through the full pipeline.

    Args:
        supabase_client: Supabase client
        item: DPro API item dict (or dpro_items DB row with dpro_item_id)
        skip_embeddings: If True, skip embedding generation (metadata+OCR+transcription only)

    Returns True on success, False on failure.
    """
    dpro_id = str(item.get("id", item.get("dpro_item_id", "?")))
    product_name = item.get("product_name", "unknown")
    logger.info(f"Processing DPro item {dpro_id}: {product_name}")

    # Step 1: Upsert dpro_items row
    row = dpro_item_to_row(item) if "production_url" in item else item
    row["processing_status"] = "processing"
    upsert_dpro_items(supabase_client, [row])

    # Get the internal id
    db_item = get_dpro_item_by_dpro_id(supabase_client, str(item["id"]))
    if not db_item:
        logger.error(f"  Failed to upsert dpro_item {dpro_id}")
        return False

    internal_id = db_item["id"]
    production_url = item.get("production_url", db_item.get("production_url", ""))

    # Skip non-video items
    media_type = item.get("media_type", db_item.get("media_type", ""))
    if media_type == "banner" or not production_url:
        logger.info(f"  Skipping non-video item (media_type={media_type})")
        supabase_client.table("dpro_items").update(
            {"processing_status": "skipped"}
        ).eq("id", internal_id).execute()
        return True

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, f"dpro_{dpro_id}.mp4")

        try:
            # Step 2: Download video
            logger.info(f"  [1/7] Downloading video...")
            video_bytes = download_dpro_video(production_url)
            with open(video_path, "wb") as f:
                f.write(video_bytes)
            logger.info(f"  Downloaded: {len(video_bytes)} bytes")

            # Step 3: Video metadata
            logger.info(f"  [2/7] Extracting video metadata...")
            vinfo = get_video_info(video_path)
            logger.info(f"  Duration: {vinfo['duration_ms']}ms, {vinfo['width']}x{vinfo['height']}")

            # Insert dpro_videos row
            video_row = {
                "dpro_item_id": internal_id,
                "duration_ms": vinfo["duration_ms"],
                "fps": vinfo["fps"],
                "width": vinfo["width"],
                "height": vinfo["height"],
                "processing_status": "processing",
                "analysis_model": f"{ANALYSIS_MODEL}+{EMBEDDING_MODEL}",
            }
            video_id = upsert_dpro_video(supabase_client, video_row)
            logger.info(f"  dpro_videos.id = {video_id}")

            # Step 4: Scene detection
            logger.info(f"  [3/7] Detecting scenes...")
            scenes = detect_scenes(video_path, SCENE_THRESHOLD)
            logger.info(f"  Found {len(scenes)} scenes")

            scene_rows = []
            for i, scene in enumerate(scenes):
                scene_rows.append({
                    "video_id": video_id,
                    "scene_index": i,
                    "start_ms": int(scene["start_sec"] * 1000),
                    "end_ms": int(scene["end_sec"] * 1000),
                    "duration_ms": int((scene["end_sec"] - scene["start_sec"]) * 1000),
                })
            upsert_dpro_scenes(supabase_client, scene_rows)
            update_dpro_video_fields(supabase_client, video_id, {"scene_count": len(scenes)})

            # Step 5: Extract frames + OCR
            logger.info(f"  [4/7] Extracting frames...")
            frame_paths = []
            for i, scene in enumerate(scenes):
                mid_sec = (scene["start_sec"] + scene["end_sec"]) / 2
                frame_path = os.path.join(tmpdir, f"scene_{i:03d}.jpg")
                if extract_frame(video_path, mid_sec, frame_path):
                    frame_paths.append(frame_path)
                else:
                    frame_paths.append(None)

            logger.info(f"  [5/7] Running OCR...")
            db_scenes = get_dpro_scenes(supabase_client, video_id)
            all_telop_texts = []

            frames_data = []
            frame_indices = []
            for i, frame_path in enumerate(frame_paths):
                if frame_path and os.path.exists(frame_path):
                    with open(frame_path, "rb") as f:
                        frames_data.append(f.read())
                    frame_indices.append(i)

            if frames_data:
                ocr_results = ocr_frames_batch(frames_data, batch_size=16)
                for idx, telop in zip(frame_indices, ocr_results):
                    if telop and idx < len(db_scenes):
                        update_dpro_scene_fields(
                            supabase_client, db_scenes[idx]["id"],
                            {"telop_text": telop}
                        )
                        all_telop_texts.append(telop)

            telop_full = "\n".join(all_telop_texts)
            if telop_full:
                update_dpro_video_fields(supabase_client, video_id, {"telop_full_text": telop_full})

            # Step 6: Transcription
            logger.info(f"  [6/7] Transcribing audio...")
            transcription = transcribe_audio(video_bytes)
            if transcription:
                update_dpro_video_fields(supabase_client, video_id, {"transcription": transcription})
                logger.info(f"    Transcription: '{transcription[:80]}...'")

            # Step 7: Embeddings
            if skip_embeddings:
                logger.info(f"  [7/7] Skipping embeddings (--skip-embeddings)")
            else:
                logger.info(f"  [7/7] Generating embeddings...")

                # 7a. Video embedding
                if vinfo["duration_ms"] <= MAX_VIDEO_DURATION_SEC * 1000:
                    embed_bytes = video_bytes
                else:
                    truncated_path = os.path.join(tmpdir, "truncated.mp4")
                    subprocess.run([
                        "ffmpeg", "-i", video_path, "-t", str(MAX_VIDEO_DURATION_SEC),
                        "-c", "copy", "-y", truncated_path,
                    ], capture_output=True, timeout=30)
                    with open(truncated_path, "rb") as f:
                        embed_bytes = f.read()

                video_emb = embed_video(embed_bytes)
                update_dpro_video_fields(supabase_client, video_id, {
                    "video_embedding": str(video_emb),
                })

                # 7b. Text embedding
                text_for_embed = "\n".join(filter(None, [
                    transcription, telop_full,
                    item.get("ad_sentence", ""), item.get("narration", ""),
                ]))
                if text_for_embed.strip():
                    text_emb = embed_text(text_for_embed[:8000])
                    update_dpro_video_fields(supabase_client, video_id, {
                        "text_embedding": str(text_emb),
                    })

                # 7c. Scene embeddings
                db_scenes = get_dpro_scenes(supabase_client, video_id)
                for i, frame_path in enumerate(frame_paths):
                    if frame_path and os.path.exists(frame_path) and i < len(db_scenes):
                        with open(frame_path, "rb") as f:
                            frame_bytes = f.read()
                        try:
                            scene_emb = embed_image(frame_bytes)
                            update_dpro_scene_fields(
                                supabase_client, db_scenes[i]["id"],
                                {"scene_embedding": str(scene_emb)}
                            )
                        except Exception as emb_err:
                            logger.warning(f"    Scene {i} embedding failed: {emb_err}")

            # Done
            update_dpro_video_fields(supabase_client, video_id, {"processing_status": "completed"})
            supabase_client.table("dpro_items").update(
                {"processing_status": "completed"}
            ).eq("id", internal_id).execute()
            logger.info(f"  ✓ Completed: {dpro_id}")
            return True

        except Exception as e:
            logger.error(f"  ✗ Failed: {dpro_id}: {e}")
            try:
                supabase_client.table("dpro_items").update({
                    "processing_status": "failed",
                }).eq("id", internal_id).execute()
                if video_id:
                    update_dpro_video_fields(supabase_client, video_id, {
                        "processing_status": "failed",
                        "error_message": str(e)[:500],
                    })
            except Exception:
                pass
            return False


def process_dpro_batch(items: list[dict], skip_embeddings: bool = False,
                       max_workers: int = 1) -> dict:
    """Process a batch of DPro items.

    Returns dict with success/fail/skip counts.
    """
    client = get_client()
    results = {"success": 0, "fail": 0, "skip": 0}

    for item in items:
        # Skip non-video
        if item.get("media_type") == "banner":
            results["skip"] += 1
            continue

        # Check if already processed
        existing = get_dpro_item_by_dpro_id(client, str(item["id"]))
        if existing and existing.get("processing_status") == "completed":
            logger.info(f"Skipping already-completed: {item['id']}")
            results["skip"] += 1
            continue

        ok = process_dpro_item(client, item, skip_embeddings=skip_embeddings)
        if ok:
            results["success"] += 1
        else:
            results["fail"] += 1

    return results


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="DPro competitor CR vectorization pipeline")
    parser.add_argument("--dpro-ids", type=str, help="Comma-separated DPro item IDs")
    parser.add_argument("--json-file", type=str, help="Path to JSON file with DPro items array")
    parser.add_argument("--skip-embeddings", action="store_true",
                        help="Skip embedding generation (metadata+OCR+transcription only)")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if args.json_file:
        with open(args.json_file, "r") as f:
            items = json.load(f)
        if isinstance(items, dict) and "items" in items:
            items = items["items"]
    elif args.dpro_ids:
        # Fetch from DB (already saved items)
        client = get_client()
        items = []
        for dpro_id in args.dpro_ids.split(","):
            item = get_dpro_item_by_dpro_id(client, dpro_id.strip())
            if item:
                items.append(item)
            else:
                logger.warning(f"DPro item {dpro_id} not found in DB")
    else:
        parser.print_help()
        return

    logger.info(f"Processing {len(items)} items...")
    results = process_dpro_batch(items, skip_embeddings=args.skip_embeddings)
    logger.info(f"Done: {results}")


if __name__ == "__main__":
    main()
