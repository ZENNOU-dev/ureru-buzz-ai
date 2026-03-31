"""CR動画ベクトル化パイプライン.

動画CRを3軸でベクトル化:
  1. 動画全体ベクトル (Gemini Embedding 2, 動画直接入力)
  2. テキスト全体ベクトル (Gemini Embedding 2, 書き起こし+テロップ+メタ)
  3. シーンごとベクトル (Gemini Embedding 2, 代表フレーム画像)

処理フロー:
  Drive DL → ffprobe → ffmpeg scene detect → ffmpeg frame extract
  → Cloud Vision OCR → Gemini Flash 書き起こし → Gemini Embedding 2
"""

import argparse
import json
import logging
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types as genai_types
from database import (
    get_client,
    upsert_cr_video,
    upsert_cr_scenes,
    update_cr_video_fields,
    update_cr_scene_fields,
    get_cr_scenes,
)
from submission_engine import extract_drive_file_id, download_from_drive

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-2-preview"
ANALYSIS_MODEL = "gemini-2.5-flash-lite"
EMBEDDING_DIM = 3072
SCENE_THRESHOLD = 0.3  # ffmpeg scene detection threshold (0-1)
MAX_VIDEO_DURATION_SEC = 120  # Gemini Embedding 2 max video input


# ============================================================
# ffmpeg utilities
# ============================================================

def get_video_info(video_path: str) -> dict:
    """Get video metadata via ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    info = json.loads(result.stdout)

    video_stream = next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "video"),
        None,
    )
    if not video_stream:
        raise ValueError(f"No video stream found in {video_path}")

    duration = float(info["format"].get("duration", 0))
    fps_str = video_stream.get("r_frame_rate", "30/1")
    fps_parts = fps_str.split("/")
    fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else float(fps_parts[0])

    return {
        "duration_ms": int(duration * 1000),
        "fps": round(fps, 2),
        "width": int(video_stream.get("width", 0)),
        "height": int(video_stream.get("height", 0)),
    }


def detect_scenes(video_path: str, threshold: float = SCENE_THRESHOLD) -> list[dict]:
    """Detect scene changes using ffmpeg select filter.

    Returns list of {"start_sec": float, "end_sec": float} for each scene.
    """
    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    # Parse pts_time from showinfo output in stderr
    timestamps = [0.0]
    for line in result.stderr.split("\n"):
        if "pts_time:" in line:
            m = re.search(r"pts_time:(\d+\.?\d*)", line)
            if m:
                timestamps.append(float(m.group(1)))

    # Get total duration
    info = get_video_info(video_path)
    total_sec = info["duration_ms"] / 1000.0
    timestamps.append(total_sec)

    # Build scene list
    scenes = []
    for i in range(len(timestamps) - 1):
        start = timestamps[i]
        end = timestamps[i + 1]
        if end - start < 0.1:  # skip micro-scenes
            continue
        scenes.append({
            "start_sec": round(start, 3),
            "end_sec": round(end, 3),
        })

    return scenes


def extract_frame(video_path: str, timestamp_sec: float, output_path: str) -> bool:
    """Extract a single frame at the given timestamp."""
    cmd = [
        "ffmpeg", "-ss", str(timestamp_sec),
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        "-y",  # overwrite
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.returncode == 0


# ============================================================
# Cloud Vision OCR
# ============================================================

def ocr_frame(frame_bytes: bytes) -> str:
    """Extract text from single frame image using Cloud Vision API."""
    results = ocr_frames_batch([frame_bytes])
    return results[0]


def ocr_frames_batch(frames_bytes_list: list[bytes], batch_size: int = 8) -> list[str]:
    """Batch OCR using Cloud Vision batch_annotate_images.

    Processes up to batch_size images per API call.
    Fresh client per call to avoid broken-pipe issues in parallel.
    Retries each chunk up to 2 times on failure.
    """
    from google.cloud import vision

    results = []

    for chunk_start in range(0, len(frames_bytes_list), batch_size):
        chunk = frames_bytes_list[chunk_start:chunk_start + batch_size]
        requests = []
        for frame_bytes in chunk:
            image = vision.Image(content=frame_bytes)
            request = vision.AnnotateImageRequest(
                image=image,
                features=[vision.Feature(type_=vision.Feature.Type.TEXT_DETECTION)],
            )
            requests.append(request)

        chunk_results = None
        for attempt in range(3):
            try:
                # Fresh client each call — avoids stale gRPC channel issues
                client = vision.ImageAnnotatorClient()
                response = client.batch_annotate_images(requests=requests)
                chunk_results = []
                for resp in response.responses:
                    if resp.error.message:
                        chunk_results.append("")
                    elif resp.text_annotations:
                        chunk_results.append(resp.text_annotations[0].description.strip())
                    else:
                        chunk_results.append("")
                break
            except Exception as e:
                logger.warning(f"Cloud Vision batch OCR attempt {attempt+1}/3 failed: {e}")
                if attempt < 2:
                    time.sleep(2 * (attempt + 1))

        if chunk_results is None:
            chunk_results = [""] * len(chunk)
        results.extend(chunk_results)

    return results


# ============================================================
# Gemini API
# ============================================================

def _get_genai_client() -> genai.Client:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY is required in .env")
    return genai.Client(api_key=api_key)


def transcribe_audio(video_bytes: bytes) -> str:
    """Transcribe audio from video using Gemini Flash."""
    client = _get_genai_client()
    response = client.models.generate_content(
        model=ANALYSIS_MODEL,
        contents=[
            genai_types.Part.from_bytes(data=video_bytes, mime_type="video/mp4"),
            "この動画の音声を日本語で書き起こしてください。音声がない場合は空文字だけを返してください。余計な説明は不要です。",
        ],
    )
    text = (response.text or "").strip() if response.text else ""
    if text in ("", "空", "音声なし", "（音声なし）"):
        return ""
    return text


def embed_video(video_bytes: bytes) -> list[float]:
    """Generate embedding for entire video using Gemini Embedding 2."""
    client = _get_genai_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=[
            genai_types.Part.from_bytes(data=video_bytes, mime_type="video/mp4"),
        ],
    )
    return result.embeddings[0].values


def embed_image(image_bytes: bytes) -> list[float]:
    """Generate embedding for an image using Gemini Embedding 2."""
    client = _get_genai_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=[
            genai_types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
        ],
    )
    return result.embeddings[0].values


def embed_text(text: str) -> list[float]:
    """Generate embedding for text using Gemini Embedding 2."""
    client = _get_genai_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=[text],
    )
    return result.embeddings[0].values


# ============================================================
# Main pipeline
# ============================================================

def process_creative(supabase_client, creative_id: int, creative_name: str,
                     cr_url: str, project_name: str = "") -> bool:
    """Process a single creative through the full vectorization pipeline.

    Returns True on success, False on failure.
    """
    logger.info(f"Processing creative {creative_id}: {creative_name}")

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, f"{creative_id}.mp4")

        try:
            # Step 1: Download from Drive (with retry)
            logger.info(f"  [1/7] Downloading video from Drive...")
            for _dl_attempt in range(3):
                try:
                    video_bytes, filename = download_from_drive(cr_url)
                    break
                except Exception as dl_err:
                    if _dl_attempt < 2:
                        logger.warning(f"  Download failed (attempt {_dl_attempt+1}): {dl_err}, retrying in 10s...")
                        time.sleep(10)
                    else:
                        raise
            with open(video_path, "wb") as f:
                f.write(video_bytes)
            logger.info(f"  Downloaded: {len(video_bytes)} bytes ({filename})")

            # Step 2: Get video metadata
            logger.info(f"  [2/7] Extracting video metadata...")
            vinfo = get_video_info(video_path)
            logger.info(f"  Duration: {vinfo['duration_ms']}ms, {vinfo['width']}x{vinfo['height']}, {vinfo['fps']}fps")

            # Insert cr_videos row
            video_row = {
                "creative_id": creative_id,
                "duration_ms": vinfo["duration_ms"],
                "fps": vinfo["fps"],
                "width": vinfo["width"],
                "height": vinfo["height"],
                "processing_status": "processing",
                "analysis_model": f"{ANALYSIS_MODEL}+{EMBEDDING_MODEL}",
            }
            video_id = upsert_cr_video(supabase_client, video_row)
            logger.info(f"  cr_videos.id = {video_id}")

            # Step 3: Scene detection
            logger.info(f"  [3/7] Detecting scenes (threshold={SCENE_THRESHOLD})...")
            scenes = detect_scenes(video_path, SCENE_THRESHOLD)
            logger.info(f"  Found {len(scenes)} scenes")

            # Insert cr_scenes rows
            scene_rows = []
            for i, scene in enumerate(scenes):
                scene_rows.append({
                    "video_id": video_id,
                    "scene_index": i,
                    "start_ms": int(scene["start_sec"] * 1000),
                    "end_ms": int(scene["end_sec"] * 1000),
                    "duration_ms": int((scene["end_sec"] - scene["start_sec"]) * 1000),
                })
            upsert_cr_scenes(supabase_client, scene_rows)

            # Update scene_count
            update_cr_video_fields(supabase_client, video_id, {"scene_count": len(scenes)})

            # Step 4: Extract representative frames
            logger.info(f"  [4/7] Extracting scene frames...")
            frame_paths = []
            for i, scene in enumerate(scenes):
                mid_sec = (scene["start_sec"] + scene["end_sec"]) / 2
                frame_path = os.path.join(tmpdir, f"scene_{i:03d}.jpg")
                if extract_frame(video_path, mid_sec, frame_path):
                    frame_paths.append(frame_path)
                else:
                    frame_paths.append(None)
            logger.info(f"  Extracted {sum(1 for f in frame_paths if f)} frames")

            # Step 5: Cloud Vision OCR (batched)
            logger.info(f"  [5/7] Running Cloud Vision OCR on frames (batch)...")
            db_scenes = get_cr_scenes(supabase_client, video_id)
            all_telop_texts = []

            # Load all frames into memory
            frames_data = []
            frame_indices = []
            for i, frame_path in enumerate(frame_paths):
                if frame_path and os.path.exists(frame_path):
                    with open(frame_path, "rb") as f:
                        frames_data.append(f.read())
                    frame_indices.append(i)

            # Batch OCR call (16 images per API call)
            if frames_data:
                ocr_results = ocr_frames_batch(frames_data, batch_size=16)
                for idx, telop in zip(frame_indices, ocr_results):
                    if telop and idx < len(db_scenes):
                        update_cr_scene_fields(supabase_client, db_scenes[idx]["id"], {"telop_text": telop})
                        all_telop_texts.append(telop)
                        logger.info(f"    Scene {idx}: telop='{telop[:50]}...'")


            telop_full = "\n".join(all_telop_texts)
            if telop_full:
                update_cr_video_fields(supabase_client, video_id, {"telop_full_text": telop_full})

            # Step 6: Audio transcription
            logger.info(f"  [6/7] Transcribing audio with Gemini Flash...")
            transcription = transcribe_audio(video_bytes)
            if transcription:
                update_cr_video_fields(supabase_client, video_id, {"transcription": transcription})
                logger.info(f"    Transcription: '{transcription[:80]}...'")
            else:
                logger.info(f"    No audio detected")

            # Step 7: Generate embeddings
            logger.info(f"  [7/7] Generating embeddings...")

            # 7a. Video whole embedding (truncate to 120s for API limit)
            if vinfo["duration_ms"] <= MAX_VIDEO_DURATION_SEC * 1000:
                embed_bytes = video_bytes
            else:
                # Truncate video to 120s using ffmpeg
                truncated_path = os.path.join(tmpdir, "truncated.mp4")
                subprocess.run([
                    "ffmpeg", "-i", video_path, "-t", str(MAX_VIDEO_DURATION_SEC),
                    "-c", "copy", "-y", truncated_path,
                ], capture_output=True, timeout=30)
                with open(truncated_path, "rb") as f:
                    embed_bytes = f.read()

            video_emb = embed_video(embed_bytes)
            logger.info(f"    Video embedding: {len(video_emb)}d")

            # 7b. Text whole embedding
            text_for_embed = f"CR名: {creative_name}\n案件: {project_name}\n音声: {transcription}\nテロップ: {telop_full}"
            text_emb = embed_text(text_for_embed)
            logger.info(f"    Text embedding: {len(text_emb)}d")

            # 7c. Scene embeddings
            scene_emb_count = 0
            for i, frame_path in enumerate(frame_paths):
                if frame_path and os.path.exists(frame_path) and i < len(db_scenes):
                    with open(frame_path, "rb") as f:
                        frame_bytes = f.read()
                    scene_emb = embed_image(frame_bytes)
                    # Convert to string format for halfvec
                    emb_str = "[" + ",".join(str(v) for v in scene_emb) + "]"
                    update_cr_scene_fields(supabase_client, db_scenes[i]["id"], {
                        "scene_embedding": emb_str,
                    })
                    scene_emb_count += 1

            logger.info(f"    Scene embeddings: {scene_emb_count} scenes")

            # Store video & text embeddings (convert to halfvec string format)
            video_emb_str = "[" + ",".join(str(v) for v in video_emb) + "]"
            text_emb_str = "[" + ",".join(str(v) for v in text_emb) + "]"

            update_cr_video_fields(supabase_client, video_id, {
                "video_embedding": video_emb_str,
                "text_embedding": text_emb_str,
                "processing_status": "completed",
            })

            # Update creative status
            supabase_client.table("creatives").update(
                {"processing_status": "completed"}
            ).eq("id", creative_id).execute()

            logger.info(f"  DONE: creative {creative_id} fully vectorized")
            return True

        except Exception as e:
            logger.error(f"  FAILED: creative {creative_id}: {e}", exc_info=True)
            # Update status to failed
            try:
                if "video_id" in locals():
                    update_cr_video_fields(supabase_client, video_id, {
                        "processing_status": "failed",
                        "error_message": str(e)[:500],
                    })
                supabase_client.table("creatives").update(
                    {"processing_status": "failed"}
                ).eq("id", creative_id).execute()
            except Exception:
                pass
            return False


def process_batch(creative_ids: list[int] = None, project_id: int = None,
                  limit: int = 5) -> dict:
    """Process a batch of creatives.

    Args:
        creative_ids: Specific creative IDs to process
        project_id: Process creatives from this project
        limit: Max number to process
    """
    supabase_client = get_client()

    if creative_ids:
        query = (supabase_client.table("creatives")
                 .select("id,creative_name,cr_url,project_id")
                 .in_("id", creative_ids))
    elif project_id:
        query = (supabase_client.table("creatives")
                 .select("id,creative_name,cr_url,project_id")
                 .eq("project_id", project_id)
                 .not_.is_("cr_url", "null")
                 .limit(limit))
    else:
        query = (supabase_client.table("creatives")
                 .select("id,creative_name,cr_url,project_id")
                 .not_.is_("cr_url", "null")
                 .eq("processing_status", "pending")
                 .limit(limit))

    result = query.execute()
    creatives = result.data

    if not creatives:
        logger.info("No creatives to process")
        return {"processed": 0, "success": 0, "failed": 0}

    # Resolve project names
    project_ids = list(set(c["project_id"] for c in creatives if c.get("project_id")))
    project_names = {}
    if project_ids:
        proj_result = (supabase_client.table("projects")
                       .select("id,name")
                       .in_("id", project_ids)
                       .execute())
        project_names = {p["id"]: p["name"] for p in proj_result.data}

    stats = {"processed": 0, "success": 0, "failed": 0}
    for cr in creatives:
        project_name = project_names.get(cr.get("project_id"), "")
        ok = process_creative(
            supabase_client,
            cr["id"],
            cr["creative_name"],
            cr["cr_url"],
            project_name,
        )
        stats["processed"] += 1
        if ok:
            stats["success"] += 1
        else:
            stats["failed"] += 1

    logger.info(f"Batch complete: {stats}")
    return stats


def main():
    parser = argparse.ArgumentParser(description="CR動画ベクトル化パイプライン")
    parser.add_argument("--creative-id", type=int, help="Process a single creative by ID")
    parser.add_argument("--creative-ids", type=str, help="Comma-separated creative IDs")
    parser.add_argument("--project-id", type=int, help="Process creatives from a project")
    parser.add_argument("--limit", type=int, default=5, help="Max creatives to process")
    parser.add_argument("--test", action="store_true", help="Test mode (process 1 creative)")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if args.test and args.creative_id:
        process_batch(creative_ids=[args.creative_id], limit=1)
    elif args.creative_ids:
        ids = [int(x.strip()) for x in args.creative_ids.split(",")]
        process_batch(creative_ids=ids)
    elif args.creative_id:
        process_batch(creative_ids=[args.creative_id])
    elif args.project_id:
        process_batch(project_id=args.project_id, limit=args.limit)
    else:
        process_batch(limit=args.limit)


if __name__ == "__main__":
    main()
