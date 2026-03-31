"""Execute migration 002: Normalize ad_insights schema.

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
    if resp.status_code != 201 and resp.status_code != 200:
        print(f"Error {resp.status_code}: {resp.text}")
        raise Exception(f"SQL execution failed: {resp.status_code}")
    return resp.json()


def run_migration():
    # Split migration into phases for better error handling
    migration_path = os.path.join(os.path.dirname(__file__), "migrations", "002_normalize_schema.sql")
    with open(migration_path) as f:
        full_sql = f.read()

    # Split by phase comments and execute each phase
    phases = []
    current = []
    for line in full_sql.split("\n"):
        if line.startswith("-- Phase") or line.startswith("-- ===="):
            if current:
                sql = "\n".join(current).strip()
                if sql and not all(l.startswith("--") or l == "" for l in sql.split("\n")):
                    phases.append(sql)
                current = []
        current.append(line)
    if current:
        sql = "\n".join(current).strip()
        if sql and not all(l.startswith("--") or l == "" for l in sql.split("\n")):
            phases.append(sql)

    # Execute as single transaction instead
    print("Executing full migration as single transaction...")
    try:
        result = execute_sql(f"BEGIN;\n{full_sql}\nCOMMIT;")
        print(f"Migration completed successfully!")
        print(f"Result: {result}")
    except Exception as e:
        print(f"Migration failed: {e}")
        print("Attempting rollback...")
        try:
            execute_sql("ROLLBACK;")
        except:
            pass
        raise


if __name__ == "__main__":
    run_migration()
