"""Execute migration 007: cats_project_config.

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
    )
    if resp.status_code != 201:
        print(f"Error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return resp.json()


def main():
    # 1. Run migration
    migration_path = os.path.join(
        os.path.dirname(__file__), "migrations", "007_cats_project_config.sql"
    )
    with open(migration_path) as f:
        sql = f.read()

    print("=== Running migration 007: cats_project_config ===")
    result = execute_sql(sql)
    print(f"Migration result: {result}")

    # 2. Verify
    verify = execute_sql("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cats_project_config'
        ORDER BY ordinal_position;
    """)
    print("\n=== cats_project_config schema ===")
    for row in verify:
        print(f"  {row['column_name']:30s} {row['data_type']:20s} nullable={row['is_nullable']}")

    print("\n=== Migration 007 complete ===")


if __name__ == "__main__":
    main()
