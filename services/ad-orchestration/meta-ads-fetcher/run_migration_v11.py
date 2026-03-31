"""Execute migration 011: Schema hardening + FK remap + data fixes.

Phase 1: Drop old FK constraints (lp_base_urls references)
Phase 2: Remap cats_contents IDs (lp_base_urls → article_lps/client_codes)
Phase 3: Add new FK constraints (article_lps/client_codes references)
Phase 4: Run 011_schema_hardening.sql (CHECK, updated_at, ON DELETE)
Phase 5: Fix duplicate cats_contents
Phase 6: Fix stale is_target accounts
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()


def get_project_ref() -> str:
    url = os.getenv("SUPABASE_URL", "")
    return url.replace("https://", "").split(".")[0]


def execute_sql(sql: str, label: str = "") -> dict | None:
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
    if resp.status_code not in (200, 201):
        print(f"  ERROR [{label}]: {resp.status_code} {resp.text[:200]}")
        return None
    result = resp.json()
    print(f"  OK [{label}]")
    return result


def run_sql_statements(statements: list[tuple[str, str]]):
    """Run list of (sql, label) tuples."""
    ok = 0
    fail = 0
    for sql, label in statements:
        result = execute_sql(sql, label)
        if result is not None:
            ok += 1
        else:
            fail += 1
    print(f"  Results: {ok} OK, {fail} FAIL")
    return fail == 0


def main():
    print("=" * 60)
    print("Migration 011: Schema Hardening + FK Remap")
    print("=" * 60)

    # ============================================================
    # Phase 1: Drop old FK constraints
    # ============================================================
    print("\n--- Phase 1: Drop old FK constraints (lp_base_urls refs) ---")
    phase1 = [
        ("ALTER TABLE cats_contents DROP CONSTRAINT IF EXISTS cats_contents_article_lp_base_fk;",
         "drop cats_contents.article_lp_base_fk"),
        ("ALTER TABLE cats_contents DROP CONSTRAINT IF EXISTS cats_contents_client_code_base_fk;",
         "drop cats_contents.client_code_base_fk"),
        ("ALTER TABLE cats_contents DROP CONSTRAINT IF EXISTS cats_contents_article_lp_fk;",
         "drop cats_contents.article_lp_fk (param)"),
        ("ALTER TABLE cats_contents DROP CONSTRAINT IF EXISTS cats_contents_client_code_fk;",
         "drop cats_contents.client_code_fk (param)"),
        ("ALTER TABLE cats_project_config DROP CONSTRAINT IF EXISTS cats_project_config_article_lp_fk;",
         "drop cats_project_config.article_lp_fk"),
        ("ALTER TABLE cats_project_config DROP CONSTRAINT IF EXISTS cats_project_config_client_code_fk;",
         "drop cats_project_config.client_code_fk"),
    ]
    if not run_sql_statements(phase1):
        print("Phase 1 had errors, but continuing (IF EXISTS guards used)")

    # ============================================================
    # Phase 2: Remap IDs in cats_contents
    # ============================================================
    print("\n--- Phase 2: Remap cats_contents IDs ---")
    # REDEN article_lp_id: lp_base_urls IDs → article_lps IDs
    remap_article = [
        (159, 9,  "若年改善_実写_スプレーセット"),
        (160, 10, "男性ホルモン_実写_3点セット"),
        (157, 7,  "若年予防_実写_3点セット"),
        (158, 8,  "若年改善_実写_3点セット"),
    ]
    # REDEN client_code_id: lp_base_urls IDs → client_codes IDs
    remap_code = [
        (161, 158, "mcl_hairspray_2980_meta_bon001"),
        (167, 164, "mcl_supple_2504_meta_bon004"),
        (169, 166, "mcl_supple_2504_meta_bon006"),
        (173, 170, "mcl_supple_2504_meta_bon010"),
    ]

    phase2 = []
    for old_id, new_id, label in remap_article:
        phase2.append((
            f"UPDATE cats_contents SET article_lp_id = {new_id} WHERE article_lp_id = {old_id};",
            f"remap article_lp_id {old_id}→{new_id} ({label})"
        ))
    for old_id, new_id, label in remap_code:
        phase2.append((
            f"UPDATE cats_contents SET client_code_id = {new_id} WHERE client_code_id = {old_id};",
            f"remap client_code_id {old_id}→{new_id} ({label})"
        ))
    run_sql_statements(phase2)

    # ============================================================
    # Phase 3: Add new FK constraints (→ article_lps / client_codes)
    # ============================================================
    print("\n--- Phase 3: Add new FK constraints ---")
    phase3 = [
        ("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_article_lp_new_fk') THEN
                ALTER TABLE cats_contents
                    ADD CONSTRAINT cats_contents_article_lp_new_fk
                    FOREIGN KEY (article_lp_id) REFERENCES article_lps(id) ON DELETE SET NULL;
            END IF;
        END $$;""",
         "add cats_contents.article_lp_id → article_lps(id)"),
        ("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_client_code_new_fk') THEN
                ALTER TABLE cats_contents
                    ADD CONSTRAINT cats_contents_client_code_new_fk
                    FOREIGN KEY (client_code_id) REFERENCES client_codes(id) ON DELETE SET NULL;
            END IF;
        END $$;""",
         "add cats_contents.client_code_id → client_codes(id)"),
        ("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_article_lp_new_fk') THEN
                ALTER TABLE cats_project_config
                    ADD CONSTRAINT cats_project_config_article_lp_new_fk
                    FOREIGN KEY (default_article_lp_id) REFERENCES article_lps(id) ON DELETE SET NULL;
            END IF;
        END $$;""",
         "add cats_project_config.default_article_lp_id → article_lps(id)"),
        ("""DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_client_code_new_fk') THEN
                ALTER TABLE cats_project_config
                    ADD CONSTRAINT cats_project_config_client_code_new_fk
                    FOREIGN KEY (default_client_code_id) REFERENCES client_codes(id) ON DELETE SET NULL;
            END IF;
        END $$;""",
         "add cats_project_config.default_client_code_id → client_codes(id)"),
    ]
    run_sql_statements(phase3)

    # ============================================================
    # Phase 4: Schema hardening (011_schema_hardening.sql)
    # ============================================================
    print("\n--- Phase 4: Schema hardening (CHECK, updated_at, ON DELETE) ---")
    migration_path = os.path.join(
        os.path.dirname(__file__), "migrations", "011_schema_hardening.sql"
    )
    with open(migration_path) as f:
        sql = f.read()
    execute_sql(sql, "011_schema_hardening.sql")

    # ============================================================
    # Phase 5: Fix duplicate cats_contents (aht_lp_1f_new_bon001-01)
    # ============================================================
    print("\n--- Phase 5: Deactivate duplicate cats_contents ---")
    # Keep only the first (lowest cats_content_id), deactivate others
    phase5_sql = """
    WITH dupes AS (
        SELECT cats_content_id,
               name,
               ROW_NUMBER() OVER (PARTITION BY name ORDER BY cats_content_id ASC) as rn
        FROM cats_contents
        WHERE name IN (
            SELECT name FROM cats_contents GROUP BY name HAVING COUNT(*) > 1
        )
    )
    UPDATE cats_contents
    SET is_active = false, status = 'duplicate'
    WHERE cats_content_id IN (
        SELECT cats_content_id FROM dupes WHERE rn > 1
    );
    """
    execute_sql(phase5_sql, "deactivate duplicate cats_contents")

    # ============================================================
    # Phase 6: Fix stale is_target on stopped projects
    # ============================================================
    print("\n--- Phase 6: Set is_target=false for stopped project accounts ---")
    phase6_sql = """
    UPDATE ad_accounts
    SET is_target = false
    WHERE is_target = true
      AND project_id IN (
          SELECT id FROM projects WHERE status = '停止中'
      );
    """
    execute_sql(phase6_sql, "is_target=false for stopped projects")

    # ============================================================
    # Phase 7: Drop deprecated columns
    # ============================================================
    print("\n--- Phase 7: Drop deprecated param columns ---")
    phase7 = [
        ("ALTER TABLE cats_contents DROP COLUMN IF EXISTS article_lp_param_id;",
         "drop cats_contents.article_lp_param_id"),
        ("ALTER TABLE cats_contents DROP COLUMN IF EXISTS client_code_param_id;",
         "drop cats_contents.client_code_param_id"),
    ]
    run_sql_statements(phase7)

    print("\n" + "=" * 60)
    print("Migration 011 complete! Run db_gatekeeper.py to verify.")
    print("=" * 60)


if __name__ == "__main__":
    main()
