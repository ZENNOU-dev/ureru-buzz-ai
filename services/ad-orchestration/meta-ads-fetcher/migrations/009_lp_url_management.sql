-- v9: LP URL管理テーブル (lp_base_urls + lp_param_codes)
-- link_urls を置き換え。ベースURL×パラメータバリエーションの2階層で管理。
-- cats_contents にFK追加して、どのURL組み合わせでCATS登録したか追跡可能に。

-- ============================================================
-- 1. lp_base_urls (ベースURL管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS lp_base_urls (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id),
    url_type        TEXT NOT NULL CHECK (url_type IN ('article_lp', 'client_code')),
    base_url        TEXT NOT NULL,
    label           TEXT,                    -- Notion上のLP名/コード名
    description     TEXT,                    -- 概要 (例: "男性向け漫画記事①")
    beyond_page_id  TEXT,                    -- Squad BeyondのページUID (例: "lowc-m2-01q-bonfk00")
    beyond_team     TEXT,                    -- Squad Beyondチーム ("ブリーチ" / "BONNOU")
    param_pattern   TEXT,                    -- "?sid={code}" / "?utm_campaign={code}" / NULL
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'available', 'stopped', 'test')),
    notion_page_id  TEXT,                    -- Notion同期キー
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, url_type, base_url)
);

CREATE INDEX IF NOT EXISTS idx_lp_base_urls_project ON lp_base_urls(project_id);

CREATE TRIGGER update_lp_base_urls_updated_at
    BEFORE UPDATE ON lp_base_urls FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. lp_param_codes (パラメータバリエーション)
-- ============================================================
CREATE TABLE IF NOT EXISTS lp_param_codes (
    id              BIGSERIAL PRIMARY KEY,
    base_url_id     BIGINT NOT NULL REFERENCES lp_base_urls(id),
    code            TEXT NOT NULL,           -- "001" / "abc123" / "campaign_x"
    full_url        TEXT NOT NULL,           -- base_url + params (完成URL)
    granularity     TEXT DEFAULT 'ad' CHECK (granularity IN ('ad', 'campaign', 'offer', 'shared')),
    notion_page_id  TEXT,                    -- Notion同期キー (クライアント発行コード用)
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(base_url_id, code)
);

CREATE INDEX IF NOT EXISTS idx_lp_param_codes_base ON lp_param_codes(base_url_id);

CREATE TRIGGER update_lp_param_codes_updated_at
    BEFORE UPDATE ON lp_param_codes FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. cats_contents にFK追加 (どのURL組み合わせを使ったか)
-- ============================================================
ALTER TABLE cats_contents ADD COLUMN IF NOT EXISTS article_lp_param_id BIGINT;
ALTER TABLE cats_contents ADD COLUMN IF NOT EXISTS client_code_param_id BIGINT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_article_lp_fk') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_article_lp_fk
            FOREIGN KEY (article_lp_param_id) REFERENCES lp_param_codes(id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_contents_client_code_fk') THEN
        ALTER TABLE cats_contents
            ADD CONSTRAINT cats_contents_client_code_fk
            FOREIGN KEY (client_code_param_id) REFERENCES lp_param_codes(id);
    END IF;
END $$;

-- ============================================================
-- 4. cats_project_config: article_lp_url / final_lp_url → FK参照に変更
--    (既存カラムは残しつつ、新FKカラムを追加)
-- ============================================================
ALTER TABLE cats_project_config ADD COLUMN IF NOT EXISTS default_article_lp_id BIGINT;
ALTER TABLE cats_project_config ADD COLUMN IF NOT EXISTS default_client_code_id BIGINT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_article_lp_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_article_lp_fk
            FOREIGN KEY (default_article_lp_id) REFERENCES lp_base_urls(id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_project_config_client_code_fk') THEN
        ALTER TABLE cats_project_config
            ADD CONSTRAINT cats_project_config_client_code_fk
            FOREIGN KEY (default_client_code_id) REFERENCES lp_base_urls(id);
    END IF;
END $$;
