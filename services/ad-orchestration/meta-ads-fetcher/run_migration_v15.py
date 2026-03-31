"""Execute migration v15: Add cats_partner_conversions + drop cats_content_groups.ad_count.

Phase 1: Create cats_partner_conversions table
Phase 2: Drop ad_count from cats_content_groups
Phase 3: Add updated_at trigger
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
    print(f"  OK [{label}]")
    return resp.json()


def main():
    # ── Phase 1: Create cats_partner_conversions ──
    print("Phase 1: Create cats_partner_conversions")
    execute_sql("""
        CREATE TABLE IF NOT EXISTS cats_partner_conversions (
            id                BIGSERIAL PRIMARY KEY,
            cats_partner_id   INT NOT NULL REFERENCES cats_partners(cats_partner_id),
            conversion_point  TEXT NOT NULL CHECK (conversion_point IN ('成果', '中間クリック')),
            result_point_id   INT,
            cats_api_id       INT REFERENCES cats_api_integrations(cats_api_id),
            pixel_id          TEXT NOT NULL,
            event_name        TEXT NOT NULL,
            event_source_url  TEXT,
            is_active         BOOLEAN DEFAULT true,
            created_at        TIMESTAMPTZ DEFAULT NOW(),
            updated_at        TIMESTAMPTZ DEFAULT NOW()
        );

        COMMENT ON TABLE cats_partner_conversions IS 'CATS媒体ごとのコンバージョン設定';
        COMMENT ON COLUMN cats_partner_conversions.cats_partner_id IS 'FK→cats_partners: どの媒体のCV設定か';
        COMMENT ON COLUMN cats_partner_conversions.conversion_point IS 'コンバージョン発生地点: 成果 or 中間クリック';
        COMMENT ON COLUMN cats_partner_conversions.result_point_id IS '成果地点番号 (成果の場合のみ: 1=LINE友達追加, 6=購入 等)';
        COMMENT ON COLUMN cats_partner_conversions.cats_api_id IS 'FK→cats_api_integrations: API連携名';
        COMMENT ON COLUMN cats_partner_conversions.pixel_id IS 'ピクセルID文字列 (Meta/TikTok)';
        COMMENT ON COLUMN cats_partner_conversions.event_name IS '発生イベント名 (Purchase/ViewContent/CompleteRegistration等)';
        COMMENT ON COLUMN cats_partner_conversions.event_source_url IS 'イベントソースURL (任意)';
    """, "create_table")

    # ── Phase 1b: Indexes ──
    print("Phase 1b: Indexes")
    execute_sql("""
        CREATE INDEX IF NOT EXISTS idx_cats_partner_conversions_partner
            ON cats_partner_conversions(cats_partner_id);
        CREATE INDEX IF NOT EXISTS idx_cats_partner_conversions_api
            ON cats_partner_conversions(cats_api_id);
    """, "indexes")

    # ── Phase 2: Drop ad_count from cats_content_groups ──
    print("Phase 2: Drop ad_count from cats_content_groups")
    execute_sql("""
        ALTER TABLE cats_content_groups DROP COLUMN IF EXISTS ad_count;
    """, "drop_ad_count")

    # ── Phase 3: updated_at trigger ──
    print("Phase 3: updated_at trigger")
    execute_sql("""
        CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON cats_partner_conversions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    """, "trigger")

    print("\nMigration v15 complete!")


if __name__ == "__main__":
    main()
