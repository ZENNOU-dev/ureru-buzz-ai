"""全CR一括ベクトル化バッチ.

自動並列制御 + リトライ + スロットリング付き。
離席中に全動画を処理する用。

Usage:
    python cr_vectorize_batch.py --project-names "ローコスト,REDEN"
    python cr_vectorize_batch.py --project-ids 18,14
    python cr_vectorize_batch.py --project-names "ローコスト,REDEN" --max-workers 3
"""

import argparse
import json
import logging
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from threading import Lock

from dotenv import load_dotenv

load_dotenv()

from database import get_client
from cr_vectorize_pipeline import process_creative

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f"vectorize_batch_{datetime.now():%Y%m%d_%H%M}.log"),
    ],
)
logger = logging.getLogger(__name__)

# ── Adaptive concurrency ──────────────────────────────────
class AdaptiveThrottle:
    """Rate-limit errors → auto-reduce workers, success streaks → scale back up."""

    def __init__(self, max_workers: int = 8, min_workers: int = 1):
        self.max_workers = max_workers
        self.min_workers = min_workers
        self.current_workers = max_workers
        self._lock = Lock()
        self._consecutive_ok = 0
        self._consecutive_fail = 0
        self._total_ok = 0
        self._total_fail = 0
        self._total_skip = 0
        self._rate_limit_hits = 0
        self._sleep_between = 0.3  # seconds between submissions

    def report_success(self):
        with self._lock:
            self._consecutive_ok += 1
            self._consecutive_fail = 0
            self._total_ok += 1
            # Scale up after 10 consecutive successes
            if self._consecutive_ok >= 10 and self.current_workers < self.max_workers:
                self.current_workers = min(self.current_workers + 1, self.max_workers)
                self._consecutive_ok = 0
                self._sleep_between = max(0.5, self._sleep_between - 0.5)
                logger.info(f"⬆ Scaling UP to {self.current_workers} workers (sleep={self._sleep_between}s)")

    def report_failure(self, is_rate_limit: bool = False):
        with self._lock:
            self._consecutive_fail += 1
            self._consecutive_ok = 0
            self._total_fail += 1
            if is_rate_limit:
                self._rate_limit_hits += 1
                # Aggressive scale-down on rate limit
                self.current_workers = max(self.min_workers, self.current_workers - 2)
                self._sleep_between = min(10.0, self._sleep_between + 2.0)
                logger.warning(
                    f"⬇ RATE LIMIT → {self.current_workers} workers (sleep={self._sleep_between}s)"
                )
            elif self._consecutive_fail >= 3:
                self.current_workers = max(self.min_workers, self.current_workers - 1)
                self._sleep_between = min(8.0, self._sleep_between + 1.0)
                logger.warning(
                    f"⬇ Consecutive failures → {self.current_workers} workers (sleep={self._sleep_between}s)"
                )

    def report_skip(self):
        with self._lock:
            self._total_skip += 1

    @property
    def stats(self):
        return {
            "ok": self._total_ok,
            "fail": self._total_fail,
            "skip": self._total_skip,
            "rate_limits": self._rate_limit_hits,
            "current_workers": self.current_workers,
        }


def is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in ["429", "rate", "quota", "resource_exhausted", "too many"])


# ── Worker function ───────────────────────────────────────
def process_one(creative: dict, project_names: dict, throttle: AdaptiveThrottle) -> dict:
    """Process a single creative with retry."""
    cid = creative["id"]
    cname = creative["creative_name"]
    cr_url = creative["cr_url"]
    pname = project_names.get(creative.get("project_id"), "")

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            # Each thread gets its own supabase client
            sb = get_client()
            ok = process_creative(sb, cid, cname, cr_url, pname)
            if ok:
                throttle.report_success()
                return {"id": cid, "name": cname, "status": "ok"}
            else:
                throttle.report_failure()
                return {"id": cid, "name": cname, "status": "fail"}
        except Exception as e:
            rate_limited = is_rate_limit_error(e)
            throttle.report_failure(is_rate_limit=rate_limited)
            if rate_limited and attempt < max_retries:
                wait = 30 * attempt  # 30s, 60s, 90s
                logger.warning(f"  Rate limit on {cname}, waiting {wait}s (attempt {attempt}/{max_retries})")
                time.sleep(wait)
            elif attempt < max_retries:
                wait = 10 * attempt
                logger.warning(f"  Error on {cname}: {e}, retrying in {wait}s (attempt {attempt}/{max_retries})")
                time.sleep(wait)
            else:
                logger.error(f"  GIVE UP on {cname} after {max_retries} attempts: {e}")
                return {"id": cid, "name": cname, "status": "fail", "error": str(e)[:200]}

    return {"id": cid, "name": cname, "status": "fail"}


# ── Main batch runner ─────────────────────────────────────
def run_batch(project_ids: list[int] = None, project_names_filter: list[str] = None,
              max_workers: int = 8):
    sb = get_client()

    # Resolve project IDs from names
    if project_names_filter and not project_ids:
        all_projects = sb.table("projects").select("id,name").execute().data
        project_ids = []
        for p in all_projects:
            for name_filter in project_names_filter:
                if name_filter.lower() in p["name"].lower():
                    project_ids.append(p["id"])
                    break
        logger.info(f"Resolved project names {project_names_filter} → IDs {project_ids}")

    if not project_ids:
        logger.error("No project IDs found")
        return

    # Get all creatives with Drive URLs
    all_creatives = []
    for pid in project_ids:
        result = (sb.table("creatives")
                  .select("id,creative_name,cr_url,project_id")
                  .eq("project_id", pid)
                  .not_.is_("cr_url", "null")
                  .order("id")
                  .execute())
        all_creatives.extend(result.data)

    logger.info(f"Total creatives with URLs: {len(all_creatives)}")

    # Filter out already completed
    completed_result = (sb.table("cr_videos")
                        .select("creative_id")
                        .eq("processing_status", "completed")
                        .execute())
    completed_ids = {r["creative_id"] for r in completed_result.data}

    remaining = [c for c in all_creatives if c["id"] not in completed_ids]
    logger.info(f"Already completed: {len(completed_ids)}, Remaining: {len(remaining)}")

    if not remaining:
        logger.info("All creatives already processed!")
        return

    # Resolve project names for metadata
    proj_result = sb.table("projects").select("id,name").in_("id", project_ids).execute()
    pname_map = {p["id"]: p["name"] for p in proj_result.data}

    # Set up adaptive throttle
    throttle = AdaptiveThrottle(max_workers=max_workers, min_workers=1)

    results = []
    start_time = time.time()

    logger.info(f"Starting batch: {len(remaining)} CRs, max_workers={max_workers}")
    logger.info("=" * 60)

    # Process in chunks to allow dynamic worker adjustment
    idx = 0
    while idx < len(remaining):
        chunk_size = throttle.current_workers * 2  # 2x workers for pipeline overlap
        chunk = remaining[idx:idx + chunk_size]

        with ThreadPoolExecutor(max_workers=throttle.current_workers) as executor:
            futures = {}
            for cr in chunk:
                # Stagger submissions
                time.sleep(throttle._sleep_between)
                future = executor.submit(process_one, cr, pname_map, throttle)
                futures[future] = cr

            for future in as_completed(futures):
                result = future.result()
                results.append(result)

                # Progress report
                done = len(results)
                total = len(remaining)
                elapsed = time.time() - start_time
                rate = done / elapsed * 3600 if elapsed > 0 else 0
                eta_h = (total - done) / rate if rate > 0 else 0

                status_icon = "✅" if result["status"] == "ok" else "❌"
                stats = throttle.stats
                logger.info(
                    f"  {status_icon} [{done}/{total}] {result['name'][:35]} "
                    f"| workers={stats['current_workers']} "
                    f"| ok={stats['ok']} fail={stats['fail']} rl={stats['rate_limits']} "
                    f"| ETA={eta_h:.1f}h"
                )

        idx += chunk_size

    # Final report
    elapsed = time.time() - start_time
    ok_count = sum(1 for r in results if r["status"] == "ok")
    fail_count = sum(1 for r in results if r["status"] == "fail")

    logger.info("=" * 60)
    logger.info(f"BATCH COMPLETE in {elapsed/3600:.1f}h")
    logger.info(f"  Success: {ok_count}/{len(results)}")
    logger.info(f"  Failed: {fail_count}/{len(results)}")
    logger.info(f"  Throttle stats: {throttle.stats}")

    # Dump failed list for retry
    failed = [r for r in results if r["status"] == "fail"]
    if failed:
        failed_path = f"vectorize_failed_{datetime.now():%Y%m%d_%H%M}.json"
        with open(failed_path, "w") as f:
            json.dump(failed, f, ensure_ascii=False, indent=2)
        logger.info(f"  Failed IDs saved to {failed_path}")


def main():
    parser = argparse.ArgumentParser(description="全CR一括ベクトル化バッチ")
    parser.add_argument("--project-ids", type=str, help="Comma-separated project IDs")
    parser.add_argument("--project-names", type=str, help="Comma-separated project names (partial match)")
    parser.add_argument("--max-workers", type=int, default=8, help="Initial max parallel workers")
    args = parser.parse_args()

    project_ids = None
    project_names_filter = None

    if args.project_ids:
        project_ids = [int(x.strip()) for x in args.project_ids.split(",")]
    if args.project_names:
        project_names_filter = [x.strip() for x in args.project_names.split(",")]

    run_batch(
        project_ids=project_ids,
        project_names_filter=project_names_filter,
        max_workers=args.max_workers,
    )


if __name__ == "__main__":
    main()
