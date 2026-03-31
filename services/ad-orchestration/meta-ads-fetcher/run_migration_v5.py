"""Execute migration 005: custom_audiences + tracking_codes.

Uses Supabase Management API to execute SQL.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()


def get_project_ref() -> str:
    url = os.getenv("SUPABASE_URL", "")
    return url.replace("https://", "").split(".")[0]


def execute_sql(sql: str) -> dict:
    """Execute SQL via Supabase Management API."""
    ref = get_project_ref()
    token = os.getenv("SUPABASE_ACCESS_TOKEN")
    if not token:
        raise ValueError("SUPABASE_ACCESS_TOKEN is required")

    resp = requests.post(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"query": sql},
        timeout=120,
    )
    if resp.status_code not in (200, 201):
        print(f"Error {resp.status_code}: {resp.text}")
        raise Exception(f"SQL execution failed: {resp.status_code}")
    return resp.json()


def run_migration():
    migration_path = os.path.join(
        os.path.dirname(__file__), "migrations", "005_custom_audiences_and_tracking_codes.sql"
    )
    with open(migration_path) as f:
        full_sql = f.read()

    print("Executing migration 005: custom_audiences + tracking_codes...")
    try:
        result = execute_sql(f"BEGIN;\n{full_sql}\nCOMMIT;")
        print("Migration 005 completed successfully!")
        print(f"Result: {result}")
    except Exception as e:
        print(f"Migration failed: {e}")
        print("Attempting rollback...")
        try:
            execute_sql("ROLLBACK;")
        except Exception:
            pass
        raise


if __name__ == "__main__":
    run_migration()
