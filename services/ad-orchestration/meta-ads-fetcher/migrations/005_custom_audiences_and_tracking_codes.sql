-- Migration 005: custom_audiences + tracking_codes + FK追加
-- Date: 2026-03-18

-- ============================================
-- 1. custom_audiences (個別オーディエンス一覧)
-- ============================================
-- Meta APIから自動取得した個別オーディエンス。
-- custom_audience_sets は「含める/除外」のセット、こちらは素材一覧。

CREATE TABLE IF NOT EXISTS custom_audiences (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    meta_audience_id TEXT NOT NULL,
    name TEXT NOT NULL,
    subtype TEXT,                    -- LOOKALIKE, CUSTOM, WEBSITE, etc.
    approximate_count INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, meta_audience_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_audiences_account
    ON custom_audiences(account_id);

-- updated_at トリガー
CREATE TRIGGER set_updated_at_custom_audiences
    BEFORE UPDATE ON custom_audiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. tracking_codes (入稿コード管理)
-- ============================================
-- CATS リダイレクトURL / UTMパラメータ / 広告名埋め込みコード を統合管理。
-- 遷移パターン:
--   direct:          CR → (CATS redirect or LP直接)
--   article_lp:      CR → 記事LP → LP
--   article_lp_cats: CR → 記事LP → CATSリダイレクト → LP

CREATE TABLE IF NOT EXISTS tracking_codes (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    account_id TEXT REFERENCES ad_accounts(account_id),

    -- コード識別
    code_name TEXT NOT NULL,
    ad_name_segment TEXT,

    -- CATS関連
    cats_code TEXT,
    cats_redirect_url TEXT,

    -- 遷移設定
    transition_type TEXT NOT NULL DEFAULT 'direct'
        CHECK (transition_type IN ('direct', 'article_lp', 'article_lp_cats')),

    -- URL群
    final_lp_url TEXT,
    article_lp_url TEXT,
    ad_delivery_url TEXT NOT NULL,

    -- UTMパラメータ (CATS不使用の場合)
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,

    -- ステータス
    is_active BOOLEAN DEFAULT true,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, code_name)
);

CREATE INDEX IF NOT EXISTS idx_tracking_codes_project
    ON tracking_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_tracking_codes_account
    ON tracking_codes(account_id);

-- updated_at トリガー
CREATE TRIGGER set_updated_at_tracking_codes
    BEFORE UPDATE ON tracking_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. submission_presets にFK追加
-- ============================================
ALTER TABLE submission_presets
    ADD COLUMN IF NOT EXISTS default_tracking_code_id BIGINT
    REFERENCES tracking_codes(id);

-- ============================================
-- 4. submission_ads にFK追加
-- ============================================
ALTER TABLE submission_ads
    ADD COLUMN IF NOT EXISTS tracking_code_id BIGINT
    REFERENCES tracking_codes(id);
