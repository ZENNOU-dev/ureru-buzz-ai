-- ============================================================
-- Migration 011: Schema Hardening
-- NOT NULL制約・CHECK制約・updated_atトリガー・ON DELETE整備
-- 全てのDDLはIF NOT EXISTS / DO $$ 安全ガード付き
-- ============================================================

-- ============================================================
-- 1. NOT NULL constraints
-- ============================================================
-- NOTE: 以下のカラムは本来NOT NULLであるべきだが、既存データに
-- NULLが含まれている可能性がある。db_gatekeeperで全NULLを
-- 正しいproject_id/client_idにマッピングした後、以下を実行すること:
--
--   ALTER TABLE projects ALTER COLUMN client_id SET NOT NULL;
--   ALTER TABLE ad_accounts ALTER COLUMN project_id SET NOT NULL;
--   ALTER TABLE creatives ALTER COLUMN project_id SET NOT NULL;
--   ALTER TABLE cats_contents ALTER COLUMN project_id SET NOT NULL;
--
-- TODO: db_gatekeeperタスクでNULL修正後にNOT NULL化する

-- ============================================================
-- 2. CHECK constraints
-- ============================================================

-- 2a. projects.status: '進行中' or '停止中'
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_projects_status') THEN
        ALTER TABLE projects
            ADD CONSTRAINT chk_projects_status
            CHECK (status IN ('進行中', '停止中'));
    END IF;
END $$;

-- 2b. clients.status: '商談','進行中','停止'
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_clients_status') THEN
        ALTER TABLE clients
            ADD CONSTRAINT chk_clients_status
            CHECK (status IN ('商談', '進行中', '停止'));
    END IF;
END $$;

-- 2c. ad_accounts.status — SKIP
-- Meta APIステータス(ACTIVE, DISABLED等)と日本語ステータスが混在しているため
-- 整理完了後に追加する

-- 2d. submission_presets.bid_strategy
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_submission_presets_bid_strategy') THEN
        ALTER TABLE submission_presets
            ADD CONSTRAINT chk_submission_presets_bid_strategy
            CHECK (bid_strategy IN ('LOWEST_COST_WITHOUT_CAP', 'COST_CAP', 'LOWEST_COST_WITH_BID_CAP'));
    END IF;
END $$;

-- 2e. submission_presets.campaign_objective
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_submission_presets_campaign_objective') THEN
        ALTER TABLE submission_presets
            ADD CONSTRAINT chk_submission_presets_campaign_objective
            CHECK (campaign_objective IN ('OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC'));
    END IF;
END $$;

-- 2f. submission_adsets.gender — SKIP (既にCHECK (gender IN (0,1,2)) が定義済み)

-- 2g. submission_adsets: age_min <= age_max
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_submission_adsets_age_range') THEN
        ALTER TABLE submission_adsets
            ADD CONSTRAINT chk_submission_adsets_age_range
            CHECK (age_min <= age_max);
    END IF;
END $$;

-- 2h. submission_presets: age_min <= age_max
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_submission_presets_age_range') THEN
        ALTER TABLE submission_presets
            ADD CONSTRAINT chk_submission_presets_age_range
            CHECK (age_min <= age_max);
    END IF;
END $$;

-- ============================================================
-- 3. updated_at columns + triggers for tables missing them
-- ============================================================
-- 既存の update_updated_at_column() 関数を使用

-- 3a. account_assets: updated_at 追加
ALTER TABLE account_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_account_assets_updated'
    ) THEN
        CREATE TRIGGER trg_account_assets_updated
            BEFORE UPDATE ON account_assets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 3b. account_rules: updated_at 追加
ALTER TABLE account_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_account_rules_updated'
    ) THEN
        CREATE TRIGGER trg_account_rules_updated
            BEFORE UPDATE ON account_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 3c. account_conversion_events: created_at, updated_at 追加
ALTER TABLE account_conversion_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE account_conversion_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_account_conversion_events_updated'
    ) THEN
        CREATE TRIGGER trg_account_conversion_events_updated
            BEFORE UPDATE ON account_conversion_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 3d. placement_presets: updated_at 追加
ALTER TABLE placement_presets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_placement_presets_updated'
    ) THEN
        CREATE TRIGGER trg_placement_presets_updated
            BEFORE UPDATE ON placement_presets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 3e. geo_targeting_presets: updated_at 追加
ALTER TABLE geo_targeting_presets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_geo_targeting_presets_updated'
    ) THEN
        CREATE TRIGGER trg_geo_targeting_presets_updated
            BEFORE UPDATE ON geo_targeting_presets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 3f. custom_audience_sets: updated_at 追加
ALTER TABLE custom_audience_sets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_custom_audience_sets_updated'
    ) THEN
        CREATE TRIGGER trg_custom_audience_sets_updated
            BEFORE UPDATE ON custom_audience_sets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 4. ON DELETE behavior
-- ============================================================
-- ads.creative_id → creatives(id): 元のFKを削除し ON DELETE SET NULL で再作成
-- ads.cats_content_id → cats_contents(cats_content_id): 同様

-- 4a. ads.creative_id → ON DELETE SET NULL
-- 002_normalize_schema.sql で ads テーブル定義時のインラインFK名を特定する必要がある
-- PostgreSQLのインラインFKは "ads_creative_id_fkey" という命名規則
DO $$ BEGIN
    -- 既存のFK制約を削除 (存在する場合)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_creative_id_fkey' AND conrelid = 'ads'::regclass) THEN
        ALTER TABLE ads DROP CONSTRAINT ads_creative_id_fkey;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_creative_id_fkey' AND conrelid = 'ads'::regclass) THEN
        ALTER TABLE ads
            ADD CONSTRAINT ads_creative_id_fkey
            FOREIGN KEY (creative_id) REFERENCES creatives(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 4b. ads.cats_content_id → ON DELETE SET NULL
-- 010_connect_all_systems.sql で "ads_cats_content_fk" として作成済み
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_cats_content_fk' AND conrelid = 'ads'::regclass) THEN
        ALTER TABLE ads DROP CONSTRAINT ads_cats_content_fk;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_cats_content_fk' AND conrelid = 'ads'::regclass) THEN
        ALTER TABLE ads
            ADD CONSTRAINT ads_cats_content_fk
            FOREIGN KEY (cats_content_id) REFERENCES cats_contents(cats_content_id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 5. Summary comments
-- ============================================================
COMMENT ON CONSTRAINT chk_projects_status ON projects
    IS 'プロジェクトステータスは進行中/停止中のみ';
COMMENT ON CONSTRAINT chk_clients_status ON clients
    IS 'クライアントステータスは商談/進行中/停止のみ';
COMMENT ON CONSTRAINT chk_submission_presets_bid_strategy ON submission_presets
    IS 'Meta API入札戦略の許可値';
COMMENT ON CONSTRAINT chk_submission_presets_campaign_objective ON submission_presets
    IS 'Meta APIキャンペーン目的の許可値';
COMMENT ON CONSTRAINT chk_submission_adsets_age_range ON submission_adsets
    IS '年齢範囲の整合性: age_min <= age_max';
COMMENT ON CONSTRAINT chk_submission_presets_age_range ON submission_presets
    IS '年齢範囲の整合性: age_min <= age_max';
