-- Migration 003: 入稿データベース (Submission Tables)
-- 入稿プロセスをDB化し、Meta API自動入稿に対応するためのテーブル群
-- ========================================================================

-- Phase 1: 設定テーブル (Supporting / Config tables)
-- ========================================================================

-- A-1. account_assets: アカウントごとのFBページ/ピクセル/IGアカウント
CREATE TABLE IF NOT EXISTS account_assets (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    asset_type TEXT NOT NULL CHECK (asset_type IN ('facebook_page', 'pixel', 'instagram_account')),
    asset_name TEXT NOT NULL,
    meta_asset_id TEXT NOT NULL,
    ig_backing_id TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, asset_type, meta_asset_id)
);

CREATE INDEX idx_account_assets_account ON account_assets(account_id);

-- A-2. account_rules: 値とルール / バリュールール
CREATE TABLE IF NOT EXISTS account_rules (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('rule', 'value_rule')),
    rule_name TEXT NOT NULL,
    meta_rule_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, rule_type, rule_name)
);

CREATE INDEX idx_account_rules_account ON account_rules(account_id);

-- A-3. placement_presets: 配置プリセット
CREATE TABLE IF NOT EXISTS placement_presets (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_advantage_plus BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A-4. geo_targeting_presets: 地域ターゲティングプリセット
CREATE TABLE IF NOT EXISTS geo_targeting_presets (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A-5. custom_audience_sets: カスタムオーディエンス設定
CREATE TABLE IF NOT EXISTS custom_audience_sets (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    include_audiences JSONB DEFAULT '[]',
    exclude_audiences JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_audience_sets_account ON custom_audience_sets(account_id);

-- A-6. submission_presets: 入稿プリセット (案件デフォルト)
CREATE TABLE IF NOT EXISTS submission_presets (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    preset_name TEXT NOT NULL,
    account_id TEXT REFERENCES ad_accounts(account_id),
    facebook_page_id BIGINT REFERENCES account_assets(id),
    pixel_id BIGINT REFERENCES account_assets(id),
    instagram_account_id BIGINT REFERENCES account_assets(id),
    campaign_objective TEXT,
    bid_strategy TEXT,
    optimization_event TEXT,
    is_asc BOOLEAN DEFAULT false,
    gender TEXT DEFAULT 'all' CHECK (gender IN ('all', 'male', 'female')),
    age_min INT DEFAULT 18,
    age_max INT DEFAULT 65,
    geo_preset_id BIGINT REFERENCES geo_targeting_presets(id),
    placement_preset_id BIGINT REFERENCES placement_presets(id),
    audience_set_id BIGINT REFERENCES custom_audience_sets(id),
    rule_id BIGINT REFERENCES account_rules(id),
    value_rule_id BIGINT REFERENCES account_rules(id),
    default_title TEXT,
    default_body TEXT,
    default_description TEXT,
    creative_type TEXT DEFAULT 'VIDEO',
    campaign_status TEXT DEFAULT 'PAUSED',
    adset_status TEXT DEFAULT 'ACTIVE',
    ad_status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, preset_name)
);

CREATE INDEX idx_submission_presets_project ON submission_presets(project_id);

-- Phase 2: 入稿コアテーブル (Core Submission tables)
-- ========================================================================

-- B-1. ad_submissions: 入口テーブル / バッチヘッダー
CREATE TABLE IF NOT EXISTS ad_submissions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    preset_id BIGINT REFERENCES submission_presets(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'submitting', 'completed', 'partial_error', 'error')),
    request_text TEXT,
    requested_by TEXT,
    facebook_page_asset_id BIGINT REFERENCES account_assets(id),
    pixel_asset_id BIGINT REFERENCES account_assets(id),
    instagram_asset_id BIGINT REFERENCES account_assets(id),
    submitted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_submissions_project ON ad_submissions(project_id);
CREATE INDEX idx_ad_submissions_account ON ad_submissions(account_id);
CREATE INDEX idx_ad_submissions_status ON ad_submissions(status);

-- B-2. submission_campaigns: 入稿キャンペーン
CREATE TABLE IF NOT EXISTS submission_campaigns (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES ad_submissions(id) ON DELETE CASCADE,
    campaign_name TEXT NOT NULL,
    objective TEXT NOT NULL,
    bid_strategy TEXT NOT NULL,
    daily_budget NUMERIC(12, 2),
    is_cbo BOOLEAN DEFAULT false,
    is_asc BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'PAUSED',
    meta_campaign_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submission_campaigns_submission ON submission_campaigns(submission_id);

-- B-3. submission_adsets: 入稿広告セット
CREATE TABLE IF NOT EXISTS submission_adsets (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES submission_campaigns(id) ON DELETE CASCADE,
    adset_name TEXT NOT NULL,
    daily_budget NUMERIC(12, 2),
    bid_amount NUMERIC(12, 2),
    bid_strategy TEXT,
    optimization_goal TEXT NOT NULL,
    promoted_pixel_id TEXT,
    promoted_custom_event TEXT,
    gender INT DEFAULT 0 CHECK (gender IN (0, 1, 2)),
    age_min INT DEFAULT 18,
    age_max INT DEFAULT 65,
    geo_locations JSONB DEFAULT '{"countries": ["JP"]}',
    placement_config JSONB,
    include_custom_audiences JSONB DEFAULT '[]',
    exclude_custom_audiences JSONB DEFAULT '[]',
    rule_id TEXT,
    value_rule_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    start_time TIMESTAMPTZ,
    meta_adset_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submission_adsets_campaign ON submission_adsets(campaign_id);

-- B-4. submission_ads: 入稿広告
CREATE TABLE IF NOT EXISTS submission_ads (
    id BIGSERIAL PRIMARY KEY,
    adset_id BIGINT NOT NULL REFERENCES submission_adsets(id) ON DELETE CASCADE,
    ad_name TEXT NOT NULL,
    creative_id BIGINT REFERENCES creatives(id),
    creative_type TEXT DEFAULT 'VIDEO',
    title TEXT,
    body TEXT,
    description TEXT,
    display_link TEXT,
    drive_url TEXT,
    link_url TEXT,
    url_parameters TEXT,
    page_id TEXT,
    instagram_actor_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    meta_ad_id TEXT,
    meta_creative_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submission_ads_adset ON submission_ads(adset_id);
CREATE INDEX idx_submission_ads_creative ON submission_ads(creative_id);

-- Phase 3: updated_at トリガー
-- ========================================================================

-- 既存の update_updated_at() 関数を再利用
CREATE TRIGGER set_updated_at BEFORE UPDATE ON submission_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ad_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
