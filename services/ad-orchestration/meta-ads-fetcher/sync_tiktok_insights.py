"""Daily sync script for TikTok ad insights.

Fetches performance data for all TikTok ad accounts
and stores to Supabase. Mirrors the Meta sync pattern.
"""

import logging
import os
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from database import get_client
from tiktok_database import get_tiktok_accounts
from tiktok_fetcher import fetch_and_store_tiktok

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def sync_all_tiktok_accounts(
    days_back: int = 3,
    sandbox: bool = False,
) -> dict:
    """Sync TikTok insights for all registered TikTok accounts.

    Args:
        days_back: Number of days to look back (default 3 for attribution lag)
        sandbox: Use TikTok sandbox environment

    Returns:
        Dict with account_id → rows_stored mapping
    """
    client = get_client()
    accounts = get_tiktok_accounts(client)

    if not accounts:
        logger.warning("No TikTok accounts found in ad_accounts table")
        return {}

    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")

    results = {}
    for account in accounts:
        account_id = account["account_id"]
        account_name = account.get("account_name", account_id)

        logger.info("Syncing TikTok account: %s (%s)", account_name, account_id)
        try:
            count = fetch_and_store_tiktok(
                account_id, start_date, end_date,
                sandbox=sandbox,
            )
            results[account_id] = count
            logger.info(
                "Synced %d rows for TikTok account %s",
                count, account_name,
            )
        except Exception as e:
            logger.error(
                "Failed to sync TikTok account %s: %s",
                account_name, e,
            )
            results[account_id] = -1

    # Run gatekeeper check after sync
    _run_gatekeeper_check()

    return results


def _run_gatekeeper_check():
    """Run db_gatekeeper after sync to verify integrity."""
    try:
        from db_gatekeeper import preflight_check
        if not preflight_check():
            logger.warning("DB gatekeeper found CRITICAL issues after TikTok sync")
        else:
            logger.info("DB gatekeeper: all clear after TikTok sync")
    except ImportError:
        logger.debug("db_gatekeeper not available, skipping check")


if __name__ == "__main__":
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    sandbox = "--sandbox" in sys.argv

    logger.info("Starting TikTok sync (days_back=%d, sandbox=%s)", days, sandbox)
    results = sync_all_tiktok_accounts(days_back=days, sandbox=sandbox)

    total = sum(v for v in results.values() if v > 0)
    errors = sum(1 for v in results.values() if v < 0)
    logger.info(
        "TikTok sync complete: %d accounts, %d total rows, %d errors",
        len(results), total, errors,
    )
