"""Sync value rules and custom audiences from Meta API to Supabase.

Fetches:
- Value Rule Sets (value_rule_set) → account_rules (rule_type='value_rule')
- Custom Audiences → custom_audiences

Skips accounts with status != 'ACTIVE'.

Usage:
    python3 sync_meta_account_settings.py
    python3 sync_meta_account_settings.py --account act_XXXXX
"""

import os
import json
import logging
import argparse

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

GRAPH_API_VERSION = "v21.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


def get_supabase() -> Client:
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


def get_token() -> str:
    token = os.getenv("META_ACCESS_TOKEN")
    if not token:
        raise ValueError("META_ACCESS_TOKEN is required")
    return token


def meta_api_get(endpoint: str, params: dict, token: str) -> list:
    """GET with pagination support."""
    params["access_token"] = token
    params.setdefault("limit", 200)
    all_data = []
    url = f"{GRAPH_BASE}/{endpoint}"

    while url:
        resp = requests.get(url, params=params, timeout=60)
        if resp.status_code != 200:
            logger.error(f"Meta API error {resp.status_code}: {resp.text[:500]}")
            break
        body = resp.json()
        all_data.extend(body.get("data", []))
        url = body.get("paging", {}).get("next")
        params = {}  # next URL has params embedded

    return all_data


# ---- Custom Audiences ----

def fetch_custom_audiences(account_id: str, token: str) -> list[dict]:
    """Fetch custom audiences for an account."""
    fields = "name,id,subtype,operation_status,delivery_status"
    data = meta_api_get(
        f"{account_id}/customaudiences",
        {"fields": fields},
        token,
    )
    results = []
    for item in data:
        results.append({
            "meta_audience_id": item["id"],
            "name": item.get("name", ""),
            "subtype": item.get("subtype"),
            "approximate_count": item.get("approximate_count_lower_bound"),
            "is_active": item.get("operation_status", {}).get("status") != 400,
        })
    return results


def sync_custom_audiences(supabase: Client, account_id: str, audiences: list[dict]):
    """Upsert custom audiences to Supabase."""
    if not audiences:
        return 0

    rows = [{"account_id": account_id, **aud} for aud in audiences]
    result = supabase.table("custom_audiences").upsert(
        rows, on_conflict="account_id,meta_audience_id",
    ).execute()
    return len(result.data)


# ---- Value Rule Sets ----

def fetch_value_rules(account_id: str, token: str) -> list[dict]:
    """Fetch value rule sets (バリュールール) for an account.

    Endpoint: GET /{account_id}/value_rule_set?fields=name,id,rules{name,adjust_sign,adjust_value,status}
    """
    fields = "name,id,rules{name,adjust_sign,adjust_value,status}"
    data = meta_api_get(
        f"{account_id}/value_rule_set",
        {"fields": fields, "product_type": "AUDIENCE"},
        token,
    )
    results = []
    for item in data:
        results.append({
            "rule_name": item.get("name", ""),
            "meta_rule_id": item["id"],
            "rule_type": "value_rule",
        })
    return results


def sync_value_rules(supabase: Client, account_id: str, rules: list[dict]):
    """Upsert value rules to Supabase."""
    if not rules:
        return 0

    rows = [{"account_id": account_id, **rule} for rule in rules]
    result = supabase.table("account_rules").upsert(
        rows, on_conflict="account_id,rule_type,rule_name",
    ).execute()
    return len(result.data)


# ---- Main ----

def get_target_accounts(supabase: Client, specific_account: str = None) -> list[dict]:
    """Get active target accounts. Skips non-ACTIVE accounts."""
    query = supabase.table("ad_accounts").select("account_id, account_name, status")
    if specific_account:
        query = query.eq("account_id", specific_account)
    else:
        # 配信中 + 一時停止 のみ (停止中はスキップ)
        query = query.eq("is_target", True).in_("status", ["配信中", "一時停止"])
    result = query.execute()
    return result.data


def main():
    parser = argparse.ArgumentParser(description="Sync Meta account settings")
    parser.add_argument("--account", help="Specific account ID (e.g., act_XXXXX)")
    args = parser.parse_args()

    supabase = get_supabase()
    token = get_token()

    accounts = get_target_accounts(supabase, args.account)
    if not accounts:
        logger.warning("No target accounts found.")
        return

    logger.info(f"Syncing {len(accounts)} active account(s)...")

    total_audiences = 0
    total_value_rules = 0

    for acc in accounts:
        account_id = acc["account_id"]
        account_name = acc["account_name"]
        logger.info(f"--- {account_name} ({account_id}) ---")

        # Custom Audiences
        try:
            audiences = fetch_custom_audiences(account_id, token)
            count = sync_custom_audiences(supabase, account_id, audiences)
            total_audiences += count
            logger.info(f"  Audiences: {count} synced")
        except Exception as e:
            logger.error(f"  Audiences error: {e}")

        # Value Rule Sets
        try:
            rules = fetch_value_rules(account_id, token)
            count = sync_value_rules(supabase, account_id, rules)
            total_value_rules += count
            logger.info(f"  Value Rules: {count} synced")
        except Exception as e:
            logger.error(f"  Value Rules error: {e}")

    logger.info(f"=== Done: {total_audiences} audiences, {total_value_rules} value rules synced ===")


if __name__ == "__main__":
    main()
