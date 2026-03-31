"""Fetch Meta Ad Accounts under a specific Business Manager."""

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()


def list_accounts():
    """Fetch ad accounts under the configured Business Manager."""
    access_token = os.getenv("META_ACCESS_TOKEN")
    business_id = os.getenv("META_BUSINESS_ID")

    if not access_token:
        print("Error: META_ACCESS_TOKEN is required. Set it in .env file.")
        return []
    if not business_id:
        print("Error: META_BUSINESS_ID is required. Set it in .env file.")
        return []

    account_list = []

    # Fetch client ad accounts under the Business Manager
    url = f"https://graph.facebook.com/v19.0/{business_id}/client_ad_accounts"
    params = {
        "fields": "account_id,name,account_status,currency,timezone_name,amount_spent",
        "limit": 100,
        "access_token": access_token,
    }

    while url:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        for acc in data.get("data", []):
            status_map = {1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED", 7: "PENDING"}
            account_list.append({
                "account_id": f"act_{acc.get('account_id', '')}",
                "name": acc.get("name", ""),
                "status": status_map.get(acc.get("account_status"), str(acc.get("account_status", ""))),
                "currency": acc.get("currency", ""),
                "timezone": acc.get("timezone_name", ""),
                "amount_spent": acc.get("amount_spent", "0"),
            })

        # Handle pagination
        next_url = data.get("paging", {}).get("next")
        if next_url:
            url = next_url
            params = {}  # params are included in the next URL
        else:
            url = None

    # Print results
    print(f"\n=== Found {len(account_list)} ad accounts (BM: {business_id}) ===\n")
    for acc in account_list:
        print(f"  {acc['account_id']} | {acc['name']} | {acc['status']} | {acc['currency']}")

    # Save to JSON
    with open("accounts.json", "w", encoding="utf-8") as f:
        json.dump(account_list, f, ensure_ascii=False, indent=2)
    print(f"\nSaved to accounts.json")

    return account_list


if __name__ == "__main__":
    list_accounts()
