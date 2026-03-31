"""競合CR分析モジュール.

動画分析PRO (DPro) のデータを使って競合CRを:
  1. 重複除外 (同一動画 + 冒頭違い検出)
  2. ベクトル化 (dpro_vectorize_pipeline)
  3. CR分析フレームワークで構造分析

Usage (from Claude skill):
  items = [...]  # PRO MCP API results
  from competitor_analysis import run_competitor_pipeline
  result = run_competitor_pipeline(items)

Usage (CLI):
  python competitor_analysis.py --json-file items.json --detect-hook-variants
"""

import json
import logging
import os
import re
import sys
from collections import defaultdict

import numpy as np
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ============================================================
# Helpers
# ============================================================

def parse_int(v) -> int:
    """Parse comma-formatted integer strings from PRO API."""
    if v is None:
        return 0
    return int(str(v).replace(",", ""))


def _extract_manage_id(production_url: str) -> str | None:
    """Extract manage_id (e.g. Instagram post ID) from production_url.

    Example: https://www.instagram.com/p/DVQMWF7DNmi/ → DVQMWF7DNmi
    """
    if not production_url:
        return None
    m = re.search(r"/p/([A-Za-z0-9_-]+)", production_url)
    return m.group(1) if m else None


def _extract_video_url(item: dict) -> str:
    """Get the actual video file URL for dedup comparison."""
    return item.get("production_share_url", "") or item.get("production_url", "")


# ============================================================
# Phase 1: Pre-processing deduplication
# ============================================================

def deduplicate_items(items: list[dict]) -> tuple[list[dict], list[dict]]:
    """Remove duplicate CRs before processing.

    Dedup rules:
      1. Same manage_id (Instagram post ID) → keep highest play_count
      2. Same production_share_url (video file) → keep highest play_count

    Returns:
        (unique_items, duplicates_removed)
    """
    if not items:
        return [], []

    # Group by manage_id
    by_manage_id: dict[str, list[dict]] = defaultdict(list)
    no_manage_id: list[dict] = []

    for item in items:
        mid = _extract_manage_id(item.get("production_url", ""))
        if mid:
            by_manage_id[mid].append(item)
        else:
            # Fallback: group by video URL
            no_manage_id.append(item)

    unique = []
    removed = []

    # For each manage_id group, keep highest play_count
    for mid, group in by_manage_id.items():
        group.sort(key=lambda x: parse_int(x.get("play_count")), reverse=True)
        unique.append(group[0])
        removed.extend(group[1:])

    # For no-manage-id items, group by production_share_url
    by_video_url: dict[str, list[dict]] = defaultdict(list)
    for item in no_manage_id:
        vurl = _extract_video_url(item)
        if vurl:
            by_video_url[vurl].append(item)
        else:
            unique.append(item)

    for vurl, group in by_video_url.items():
        group.sort(key=lambda x: parse_int(x.get("play_count")), reverse=True)
        unique.append(group[0])
        removed.extend(group[1:])

    logger.info(
        f"Pre-dedup: {len(items)} → {len(unique)} unique "
        f"({len(removed)} duplicates removed)"
    )
    return unique, removed


# ============================================================
# Phase 2: Hook variant detection (transcript text comparison)
# ============================================================

def _split_hook_body(transcription: str, hook_lines: int = 3) -> tuple[str, str]:
    """Split transcription into hook (first N lines) and body (rest).

    Returns (hook_text, body_text).
    """
    if not transcription:
        return "", ""
    lines = [l.strip() for l in transcription.strip().split("\n") if l.strip()]
    hook = "\n".join(lines[:hook_lines])
    body = "\n".join(lines[hook_lines:])
    return hook, body


def _normalize_body_text(text: str) -> str:
    """Normalize body text for comparison.

    - Remove numbers (prices, counts change between variants)
    - Remove whitespace differences
    - Lowercase
    """
    import unicodedata
    # Normalize unicode
    text = unicodedata.normalize("NFKC", text)
    # Remove digits and common price/number patterns
    text = re.sub(r"[\d,\.]+円", "N円", text)
    text = re.sub(r"[\d,\.]+万", "N万", text)
    text = re.sub(r"[\d,\.]+%", "N%", text)
    text = re.sub(r"[\d,\.]+院", "N院", text)
    text = re.sub(r"[\d,\.]+名", "N名", text)
    text = re.sub(r"[\d,\.]+ヶ月", "Nヶ月", text)
    text = re.sub(r"[\d,\.]+秒", "N秒", text)
    text = re.sub(r"[\d,]+", "N", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _body_text_similarity(body_a: str, body_b: str) -> float:
    """Compare two body texts using SequenceMatcher.

    Returns ratio 0.0-1.0. Higher = more similar.
    """
    from difflib import SequenceMatcher
    norm_a = _normalize_body_text(body_a)
    norm_b = _normalize_body_text(body_b)
    if not norm_a or not norm_b:
        return 0.0
    return SequenceMatcher(None, norm_a, norm_b).ratio()


def detect_hook_variants(supabase_client, product_name: str,
                         similarity_threshold: float = 0.75) -> list[dict]:
    """Detect hook variants within a product's CRs using transcript text.

    Hook variant = same body text (after first 3 lines), different hook.
    Comparison normalizes numbers (prices/counts vary between variants).
    Threshold 0.75 = 75% of body text is the same after normalization.

    Keep only the CR with highest play_count in each variant group.

    Returns list of variant groups:
      [{"representative": dpro_item_id, "variants": [...], "body_similarity": float}]
    """
    # Fetch all completed dpro items + their transcriptions
    result = (supabase_client.table("dpro_items")
              .select("id, dpro_item_id, product_name, play_count, processing_status")
              .eq("product_name", product_name)
              .eq("processing_status", "completed")
              .execute())
    items = result.data
    if len(items) < 2:
        return []

    # Fetch transcriptions
    item_bodies: dict[int, str] = {}
    item_hooks: dict[int, str] = {}
    for item in items:
        vid_result = (supabase_client.table("dpro_videos")
                      .select("transcription")
                      .eq("dpro_item_id", item["id"])
                      .eq("processing_status", "completed")
                      .limit(1)
                      .execute())
        if not vid_result.data or not vid_result.data[0].get("transcription"):
            continue
        hook, body = _split_hook_body(vid_result.data[0]["transcription"])
        if body:
            item_bodies[item["id"]] = body
            item_hooks[item["id"]] = hook

    logger.info(f"Hook variant detection (text): {len(item_bodies)} CRs with transcription")

    # Build maps
    play_map = {it["id"]: it.get("play_count") or 0 for it in items}
    dpro_id_map = {it["id"]: it["dpro_item_id"] for it in items}

    # Pairwise body text comparison
    item_ids = list(item_bodies.keys())
    variant_groups: list[set] = []
    pair_sims: dict[tuple, float] = {}

    for i in range(len(item_ids)):
        for j in range(i + 1, len(item_ids)):
            id_a, id_b = item_ids[i], item_ids[j]
            sim = _body_text_similarity(item_bodies[id_a], item_bodies[id_b])
            if sim >= similarity_threshold:
                pair_sims[(id_a, id_b)] = sim
                logger.info(
                    f"  Hook variant pair: {dpro_id_map[id_a]} ↔ {dpro_id_map[id_b]} "
                    f"body_sim={sim:.3f}"
                )
                # Merge into variant groups (union-find style)
                merged = False
                for group in variant_groups:
                    if id_a in group or id_b in group:
                        group.add(id_a)
                        group.add(id_b)
                        merged = True
                        break
                if not merged:
                    variant_groups.append({id_a, id_b})

    # Merge overlapping groups
    merged_groups = []
    for group in variant_groups:
        found = False
        for mg in merged_groups:
            if mg & group:
                mg |= group
                found = True
                break
        if not found:
            merged_groups.append(group)

    # For each group, pick representative (highest play_count)
    results = []
    for group in merged_groups:
        members = sorted(group, key=lambda x: play_map.get(x, 0), reverse=True)
        rep = members[0]
        variants = members[1:]

        # Average body similarity within group
        sims = []
        for id_a in group:
            for id_b in group:
                if id_a < id_b:
                    s = pair_sims.get((id_a, id_b)) or pair_sims.get((id_b, id_a))
                    if s:
                        sims.append(s)

        results.append({
            "representative": dpro_id_map[rep],
            "representative_play_count": play_map[rep],
            "representative_hook": item_hooks.get(rep, ""),
            "variants": [dpro_id_map[v] for v in variants],
            "variant_play_counts": [play_map[v] for v in variants],
            "variant_hooks": [item_hooks.get(v, "") for v in variants],
            "body_similarity": float(np.mean(sims)) if sims else 0,
        })

    logger.info(f"Found {len(results)} hook variant groups")
    return results


def mark_hook_variants(supabase_client, variant_groups: list[dict]) -> int:
    """Mark hook variants in dpro_items metadata.

    Representative gets is_hook_variant_rep=True.
    Variants get is_hook_variant=True, hook_variant_rep=<rep dpro_item_id>.

    Returns number of items marked as variants (excluded from analysis).
    """
    marked = 0
    for group in variant_groups:
        rep_id = group["representative"]

        # Mark representative
        supabase_client.table("dpro_items").update({
            "metadata": json.dumps({
                "is_hook_variant_rep": True,
                "hook_variant_group_size": len(group["variants"]) + 1,
            })
        }).eq("dpro_item_id", rep_id).execute()

        # Mark variants
        for var_id in group["variants"]:
            supabase_client.table("dpro_items").update({
                "metadata": json.dumps({
                    "is_hook_variant": True,
                    "hook_variant_rep": rep_id,
                })
            }).eq("dpro_item_id", var_id).execute()
            marked += 1

    logger.info(f"Marked {marked} CRs as hook variants (excluded from analysis)")
    return marked


# ============================================================
# Phase 3: Prepare items for dpro_vectorize_pipeline
# ============================================================

def prepare_items_for_pipeline(items: list[dict]) -> list[dict]:
    """Normalize PRO API items for dpro_vectorize_pipeline.

    Handles comma-formatted integers from PRO API.
    Filters to video items only.
    """
    prepared = []
    for item in items:
        if item.get("media_type") == "banner":
            continue
        if not item.get("production_share_url") and not item.get("production_url"):
            continue

        # Normalize comma-formatted fields
        normalized = dict(item)
        for field in ("cost", "cost_difference", "play_count", "digg_count",
                       "prev_cost", "prev_play_count", "prev_digg_count",
                       "play_count_difference", "digg_count_difference"):
            if field in normalized and isinstance(normalized[field], str):
                normalized[field] = str(parse_int(normalized[field]))

        # Ensure production_url points to video file for download
        if normalized.get("production_share_url"):
            normalized["_original_production_url"] = normalized.get("production_url", "")
            normalized["production_url"] = normalized["production_share_url"]

        prepared.append(normalized)

    return prepared


# ============================================================
# Full pipeline orchestration
# ============================================================

def run_competitor_pipeline(
    items: list[dict],
    skip_embeddings: bool = False,
    detect_variants: bool = True,
    variant_threshold: float = 0.92,
) -> dict:
    """Run the full competitor analysis pipeline.

    1. Deduplicate items
    2. Run dpro_vectorize_pipeline
    3. Detect hook variants (optional)

    Returns summary dict.
    """
    from dpro_vectorize_pipeline import process_dpro_batch
    from database import get_client

    # Phase 1: Pre-dedup
    unique_items, pre_dupes = deduplicate_items(items)
    prepared = prepare_items_for_pipeline(unique_items)

    logger.info(f"Pipeline: {len(items)} raw → {len(unique_items)} unique → {len(prepared)} videos")

    # Phase 2: Vectorize
    vectorize_result = process_dpro_batch(prepared, skip_embeddings=skip_embeddings)

    # Phase 3: Hook variant detection
    variant_groups = []
    variants_marked = 0
    if detect_variants and not skip_embeddings:
        client = get_client()
        # Group by product_name and detect within each
        products = set(it.get("product_name", "") for it in prepared)
        for product in products:
            if not product:
                continue
            groups = detect_hook_variants(client, product, variant_threshold)
            variant_groups.extend(groups)

        if variant_groups:
            variants_marked = mark_hook_variants(client, variant_groups)

    return {
        "total_input": len(items),
        "pre_dedup_removed": len(pre_dupes),
        "videos_processed": len(prepared),
        "vectorize_result": vectorize_result,
        "hook_variant_groups": len(variant_groups),
        "hook_variants_excluded": variants_marked,
        "unique_for_analysis": len(prepared) - variants_marked,
    }


# ============================================================
# Analysis output helpers
# ============================================================

def get_analysis_candidates(supabase_client, product_names: list[str]) -> list[dict]:
    """Get completed dpro items that are NOT hook variants, for CR analysis.

    Returns items with their video data (transcription, telop, embeddings).
    """
    candidates = []
    for pname in product_names:
        items_result = (supabase_client.table("dpro_items")
                        .select("*")
                        .eq("product_name", pname)
                        .eq("processing_status", "completed")
                        .execute())

        for item in items_result.data:
            # Skip hook variants (not representatives)
            meta = item.get("metadata")
            if isinstance(meta, str):
                meta = json.loads(meta)
            if isinstance(meta, dict) and meta.get("is_hook_variant"):
                continue

            # Get video data
            vid_result = (supabase_client.table("dpro_videos")
                          .select("*")
                          .eq("dpro_item_id", item["id"])
                          .eq("processing_status", "completed")
                          .limit(1)
                          .execute())
            if not vid_result.data:
                continue

            video = vid_result.data[0]
            candidates.append({
                "dpro_item_id": item["dpro_item_id"],
                "product_name": item["product_name"],
                "advertiser_name": item["advertiser_name"],
                "play_count": item["play_count"],
                "cost": item["cost"],
                "cost_difference": item["cost_difference"],
                "production_url": item.get("metadata", {}).get("_original_production_url")
                    or item["production_url"],
                "ad_sentence": item["ad_sentence"],
                "transcription": video.get("transcription"),
                "telop_full_text": video.get("telop_full_text"),
                "duration_ms": video.get("duration_ms"),
                "scene_count": video.get("scene_count"),
            })

    return candidates


# ============================================================
# CLI
# ============================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Competitor CR analysis pipeline")
    parser.add_argument("--json-file", required=True,
                        help="Path to JSON file with PRO API items")
    parser.add_argument("--skip-embeddings", action="store_true")
    parser.add_argument("--no-variant-detection", action="store_true")
    parser.add_argument("--variant-threshold", type=float, default=0.92)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    with open(args.json_file) as f:
        data = json.load(f)

    items = data.get("items", data) if isinstance(data, dict) else data

    result = run_competitor_pipeline(
        items,
        skip_embeddings=args.skip_embeddings,
        detect_variants=not args.no_variant_detection,
        variant_threshold=args.variant_threshold,
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
