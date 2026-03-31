"""TikTok Marketing API authentication and token management."""

import os
import logging
from datetime import datetime, timezone

import json

import requests

logger = logging.getLogger(__name__)

TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3"
TIKTOK_SANDBOX_BASE = "https://sandbox-ads.tiktok.com/open_api/v1.3"


def get_tiktok_config(sandbox: bool = False) -> dict:
    """Load TikTok API configuration from environment variables."""
    app_id = os.getenv("TIKTOK_APP_ID")
    app_secret = os.getenv("TIKTOK_APP_SECRET")
    access_token = os.getenv("TIKTOK_ACCESS_TOKEN")

    if not app_id or not app_secret:
        raise ValueError(
            "TIKTOK_APP_ID and TIKTOK_APP_SECRET are required. Set them in .env file."
        )
    if not access_token:
        raise ValueError(
            "TIKTOK_ACCESS_TOKEN is required. Set it in .env file."
        )

    return {
        "app_id": app_id,
        "app_secret": app_secret,
        "access_token": access_token,
        "base_url": TIKTOK_SANDBOX_BASE if sandbox else TIKTOK_API_BASE,
    }


def tiktok_api_request(
    method: str,
    endpoint: str,
    *,
    params: dict | None = None,
    json_body: dict | None = None,
    sandbox: bool = False,
) -> dict:
    """Make an authenticated request to the TikTok Marketing API.

    Args:
        method: HTTP method ('GET' or 'POST')
        endpoint: API endpoint path (e.g., '/report/integrated/get/')
        params: Query parameters (for GET requests)
        json_body: JSON body (for POST requests)
        sandbox: Use sandbox environment

    Returns:
        Response data dict. Raises on API error.
    """
    config = get_tiktok_config(sandbox=sandbox)
    url = f"{config['base_url']}{endpoint}"
    headers = {
        "Access-Token": config["access_token"],
        "Content-Type": "application/json",
    }

    if method.upper() == "GET":
        # TikTok API requires dict/list params as JSON strings in query params
        if params:
            serialized = {}
            for k, v in params.items():
                if isinstance(v, (dict, list)):
                    serialized[k] = json.dumps(v)
                else:
                    serialized[k] = v
            params = serialized
        resp = requests.get(url, headers=headers, params=params, timeout=60)
    else:
        resp = requests.post(url, headers=headers, json=json_body, timeout=60)

    resp.raise_for_status()
    data = resp.json()

    # TikTok API returns code=0 on success
    if data.get("code") != 0:
        error_msg = data.get("message", "Unknown error")
        request_id = data.get("request_id", "")
        raise TikTokAPIError(
            f"TikTok API error (code={data.get('code')}): {error_msg} "
            f"[request_id={request_id}]"
        )

    return data.get("data", {})


class TikTokAPIError(Exception):
    """Custom exception for TikTok API errors."""
    pass


def refresh_access_token(sandbox: bool = False) -> dict:
    """Refresh the TikTok access token.

    TikTok access tokens expire after 24 hours.
    Requires TIKTOK_REFRESH_TOKEN in .env.

    Returns:
        Dict with new access_token and refresh_token.
    """
    config = get_tiktok_config(sandbox=sandbox)
    refresh_token = os.getenv("TIKTOK_REFRESH_TOKEN")
    if not refresh_token:
        raise ValueError("TIKTOK_REFRESH_TOKEN is required for token refresh.")

    url = f"{config['base_url']}/oauth2/access_token/"
    payload = {
        "app_id": config["app_id"],
        "secret": config["app_secret"],
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }

    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != 0:
        raise TikTokAPIError(
            f"Token refresh failed: {data.get('message', 'Unknown error')}"
        )

    token_data = data.get("data", {})
    logger.info(
        "TikTok token refreshed. New token expires in %s seconds.",
        token_data.get("expires_in", "?"),
    )
    return token_data


def get_advertiser_ids(sandbox: bool = False) -> list[str]:
    """Get list of authorized advertiser IDs.

    Returns:
        List of advertiser_id strings.
    """
    data = tiktok_api_request(
        "GET",
        "/oauth2/advertiser/get/",
        params={"app_id": os.getenv("TIKTOK_APP_ID")},
        sandbox=sandbox,
    )
    return data.get("list", [])
