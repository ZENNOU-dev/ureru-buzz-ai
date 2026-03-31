"""Execute migration 009: lp_base_urls + lp_param_codes.

Creates LP URL management tables and migrates link_urls data.
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
        os.path.dirname(__file__), "migrations", "009_lp_url_management.sql"
    )
    with open(migration_path) as f:
        sql = f.read()

    print("=== Running migration 009: lp_base_urls + lp_param_codes ===")
    # Split into statements and run each, skipping failures for idempotency
    import re
    # Split on semicolons not inside $$ blocks
    statements = []
    current = []
    in_dollar = False
    for line in sql.split('\n'):
        stripped = line.strip()
        if stripped.startswith('--') and not in_dollar:
            continue
        if '$$' in stripped:
            in_dollar = not in_dollar
        current.append(line)
        if stripped.endswith(';') and not in_dollar:
            stmt = '\n'.join(current).strip()
            if stmt and stmt != ';':
                statements.append(stmt)
            current = []
    if current:
        stmt = '\n'.join(current).strip()
        if stmt:
            statements.append(stmt)

    for i, stmt in enumerate(statements):
        try:
            result = execute_sql(stmt)
            print(f"  Statement {i+1}/{len(statements)}: OK")
        except Exception as e:
            print(f"  Statement {i+1}/{len(statements)}: SKIPPED ({e})")

    # 2. Verify lp_base_urls
    verify1 = execute_sql("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'lp_base_urls'
        ORDER BY ordinal_position;
    """)
    print("\n=== lp_base_urls schema ===")
    for row in verify1:
        print(f"  {row['column_name']:30s} {row['data_type']:20s} nullable={row['is_nullable']}")

    # 3. Verify lp_param_codes
    verify2 = execute_sql("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'lp_param_codes'
        ORDER BY ordinal_position;
    """)
    print("\n=== lp_param_codes schema ===")
    for row in verify2:
        print(f"  {row['column_name']:30s} {row['data_type']:20s} nullable={row['is_nullable']}")

    # 4. Migrate link_urls → lp_base_urls
    print("\n=== Migrating link_urls → lp_base_urls ===")
    existing = execute_sql("SELECT * FROM link_urls;")
    print(f"link_urls rows: {len(existing)}")
    for row in existing:
        print(f"  id={row['id']} project_id={row['project_id']} name={row['name']} url={row['url']} type={row['url_type']}")

    if existing:
        # Map link_urls.url_type to lp_base_urls.url_type
        # link_urls has: direct / article_lp / client_code
        # lp_base_urls has: article_lp / client_code
        # 'direct' → 'client_code' (direct LP is essentially a client code destination)
        for row in existing:
            old_type = row['url_type']
            new_type = old_type if old_type in ('article_lp', 'client_code') else 'client_code'

            migrate_sql = f"""
                INSERT INTO lp_base_urls (project_id, url_type, base_url, label, is_active)
                VALUES (
                    {row['project_id']},
                    '{new_type}',
                    '{row['url'].replace("'", "''")}',
                    '{row['name'].replace("'", "''")}',
                    {str(row.get('is_active', True)).lower()}
                )
                ON CONFLICT (project_id, url_type, base_url) DO NOTHING
                RETURNING id;
            """
            migrated = execute_sql(migrate_sql)
            if migrated:
                print(f"  Migrated: link_urls.id={row['id']} → lp_base_urls.id={migrated[0]['id']}")
            else:
                print(f"  Already exists or skipped: link_urls.id={row['id']}")

    # 5. Final counts
    counts = execute_sql("""
        SELECT
            (SELECT count(*) FROM lp_base_urls) AS base_count,
            (SELECT count(*) FROM lp_param_codes) AS param_count;
    """)
    print(f"\n=== Final counts ===")
    print(f"  lp_base_urls: {counts[0]['base_count']} rows")
    print(f"  lp_param_codes: {counts[0]['param_count']} rows")

    print("\n=== Migration 009 complete ===")


if __name__ == "__main__":
    main()
