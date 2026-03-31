"""Meta Ads data pipeline - Notion sync + Meta API fetch every 30 minutes."""

import os
import sys
import logging
import signal
import schedule
import time
from dotenv import load_dotenv

from fetcher import run_fetch
from sync_notion_to_supabase import sync_all
from sync_sheets_to_notion import read_sheets_data, run_migration

# Load environment variables
load_dotenv()

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("meta_ads_fetcher.log"),
    ],
)
logger = logging.getLogger(__name__)


def sync_job():
    """Sync Notion databases to Supabase (incremental after first run)."""
    logger.info("=== Starting Notion → Supabase sync ===")
    try:
        sync_all(incremental=True)
        logger.info("=== Notion sync complete ===")
    except Exception as e:
        logger.error(f"=== Notion sync failed: {e} ===", exc_info=True)


def fetch_job():
    """Fetch Meta Ads data and save to Supabase."""
    logger.info("=== Starting Meta Ads fetch ===")
    try:
        total = run_fetch()
        logger.info(f"=== Meta fetch complete: {total} rows ===")
    except Exception as e:
        logger.error(f"=== Meta fetch failed: {e} ===", exc_info=True)


def sheets_sync_job():
    """Sync new CRs from Google Sheets 【制作DB】 to Notion."""
    logger.info("=== Starting Sheets → Notion CR sync ===")
    try:
        rows = read_sheets_data()
        if rows:
            created = run_migration(rows)
            logger.info(f"=== Sheets sync complete: {created} new CRs ===")
        else:
            logger.info("=== Sheets sync: no rows to process ===")
    except Exception as e:
        logger.error(f"=== Sheets sync failed: {e} ===", exc_info=True)


def full_job():
    """Run the full pipeline: Sheets→Notion → Notion→Supabase → Meta fetch."""
    sheets_sync_job()
    sync_job()
    fetch_job()


def handle_shutdown(signum, frame):
    logger.info("Shutdown signal received. Exiting.")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    interval = int(os.getenv("FETCH_INTERVAL_MINUTES", "30"))
    logger.info(f"Ad Orchestration Pipeline starting. Interval: {interval} min")
    logger.info(f"  1. Sheets 【制作DB】 → Notion CR sync")
    logger.info(f"  2. Notion → Supabase sync (incremental)")
    logger.info(f"  3. Meta Ads API → Supabase fetch")

    # First run: full pipeline
    logger.info("=== Initial full sync ===")
    sheets_sync_job()
    try:
        sync_all(incremental=False)  # Full sync on startup
    except Exception as e:
        logger.error(f"Initial Notion sync failed: {e}", exc_info=True)
    fetch_job()

    # Schedule recurring runs
    schedule.every(interval).minutes.do(full_job)

    logger.info(f"Scheduler running. Next run in {interval} minutes.")
    while True:
        schedule.run_pending()
        time.sleep(10)


if __name__ == "__main__":
    main()
