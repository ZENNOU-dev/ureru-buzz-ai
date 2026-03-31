-- ============================================
-- Supabase Schema for Ad Orchestration (v3)
-- ============================================
-- Notion DB <-> Supabase table mapping:
--   取引先DB                  → clients
--   案件DB                    → projects
--   Meta広告アカウント管理    → ad_accounts
--   Creative Database         → creatives
-- Meta API hierarchy:
--   campaigns → adsets → ads → ad_daily_metrics + ad_action_stats
-- Submission (入稿):
--   account_assets, account_rules, placement_presets,
--   geo_targeting_presets, custom_audience_sets, submission_presets,
--   ad_submissions → submission_campaigns → submission_adsets → submission_ads
-- Derived:
--   ad_daily_conversions (VIEW)
-- System:
--   fetch_log, account_conversion_events
-- ============================================

-- Enable pgvector extension (for Gemini Embedding 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. 取引先管理 (Notion 取引先DB)
-- ============================================
CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    notion_page_id TEXT UNIQUE,              -- Notion連携用ページID
    company_name TEXT NOT NULL,              -- 会社名
    industry TEXT,                           -- 業種 (広告主 / 広告代理店)
    status TEXT DEFAULT '進行中',             -- 取引先ステータス (商談/進行中/停止)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 案件管理 (Notion 案件DB)
-- ============================================
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    notion_page_id TEXT UNIQUE,              -- Notion連携用ページID
    name TEXT NOT NULL,                      -- 案件名
    genre TEXT,                              -- ジャンル (リスト送客/EC/店舗集客)
    industry TEXT,                           -- 業種 (美容液, 脱毛サロン, etc.)
    status TEXT DEFAULT '進行中',             -- 稼働状況 (停止中/進行中)
    client_id BIGINT REFERENCES clients(id), -- 取引先FK
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================
-- 3. 広告アカウント管理 (Notion Meta広告アカウント管理)
-- ============================================
CREATE TABLE ad_accounts (
    account_id TEXT PRIMARY KEY,             -- act_XXXXX
    account_name TEXT NOT NULL,              -- アカウント名
    notion_page_id TEXT UNIQUE,              -- Notion連携用ページID
    project_id BIGINT REFERENCES projects(id), -- 案件FK
    business_manager_id TEXT,                -- ビジマネID
    status TEXT DEFAULT 'ACTIVE',            -- ステータス
    timezone TEXT DEFAULT 'Asia/Tokyo',      -- タイムゾーン
    is_target BOOLEAN DEFAULT false,         -- データ取得対象
    has_mcv BOOLEAN DEFAULT false,           -- MCV有無
    last_fetched_at TIMESTAMPTZ,             -- 最終取得日時
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_accounts_project ON ad_accounts(project_id);

-- ============================================
-- 4. CV/MCVイベント設定
-- ============================================
CREATE TABLE account_conversion_events (
    account_id       TEXT NOT NULL REFERENCES ad_accounts(account_id),
    event_role       TEXT NOT NULL CHECK (event_role IN ('cv', 'mcv')),
    meta_action_type TEXT NOT NULL,
    display_name     TEXT,
    PRIMARY KEY (account_id, event_role)
);

-- ============================================
-- 5. クリエイティブ管理 (Notion Creative Database + ベクトル検索)
-- ============================================
CREATE TABLE creatives (
    id BIGSERIAL PRIMARY KEY,
    creative_name TEXT UNIQUE NOT NULL,      -- CR名
    notion_page_id TEXT UNIQUE,              -- Notion連携用ページID
    project_id BIGINT REFERENCES projects(id), -- 案件FK
    cr_url TEXT,                             -- CR URL (動画/画像URL)
    thumbnail_url TEXT,
    person_in_charge TEXT,                   -- 担当者
    description TEXT,
    processing_status TEXT DEFAULT 'pending', -- embedding処理ステータス
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creatives_project ON creatives(project_id);

-- ============================================
-- 6. キャンペーン (Meta API dimension)
-- ============================================
CREATE TABLE campaigns (
    campaign_id   TEXT PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    account_id    TEXT NOT NULL REFERENCES ad_accounts(account_id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_account ON campaigns(account_id);

-- ============================================
-- 7. 広告セット (Meta API dimension)
-- ============================================
CREATE TABLE adsets (
    adset_id    TEXT PRIMARY KEY,
    adset_name  TEXT NOT NULL,
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adsets_campaign ON adsets(campaign_id);

-- ============================================
-- 8. 広告 (Meta API dimension, with creative FK)
-- ============================================
CREATE TABLE ads (
    ad_id            TEXT PRIMARY KEY,
    ad_name          TEXT NOT NULL,
    adset_id         TEXT NOT NULL REFERENCES adsets(adset_id),
    creative_id      BIGINT REFERENCES creatives(id),  -- CR紐付け (初回パースで確定)
    meta_creative_id TEXT,                              -- Meta API の creative.id
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ads_adset ON ads(adset_id);
CREATE INDEX idx_ads_creative ON ads(creative_id);

-- ============================================
-- 9. 日次メトリクス (fact table, 数値のみ)
-- ============================================
CREATE TABLE ad_daily_metrics (
    date         DATE NOT NULL,
    ad_id        TEXT NOT NULL REFERENCES ads(ad_id),
    spend        NUMERIC(12,2) DEFAULT 0,
    impressions  INT DEFAULT 0,
    reach        INT DEFAULT 0,
    clicks       INT DEFAULT 0,
    cpc          NUMERIC(10,4),
    cpm          NUMERIC(10,4),
    ctr          NUMERIC(8,6),
    cpp          NUMERIC(10,4),
    video_plays       INT DEFAULT 0,
    video_3s_views    INT DEFAULT 0,
    video_p25_views   INT DEFAULT 0,
    video_p50_views   INT DEFAULT 0,
    video_p75_views   INT DEFAULT 0,
    video_p95_views   INT DEFAULT 0,
    video_p100_views  INT DEFAULT 0,
    fetched_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id)
);

CREATE INDEX idx_ad_daily_metrics_ad ON ad_daily_metrics(ad_id);
CREATE INDEX idx_ad_daily_metrics_date ON ad_daily_metrics(date);

-- ============================================
-- 10. アクション統計 (EAV, CV/MCV等)
-- ============================================
CREATE TABLE ad_action_stats (
    date          DATE NOT NULL,
    ad_id         TEXT NOT NULL REFERENCES ads(ad_id),
    action_type   TEXT NOT NULL,   -- Meta API action_type そのまま保存
    value         INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, action_type)
);

CREATE INDEX idx_ad_action_stats_ad ON ad_action_stats(ad_id);

-- ============================================
-- 11. 取得ログ
-- ============================================
CREATE TABLE fetch_log (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL,                    -- success / error
    rows_fetched INTEGER DEFAULT 0,
    error_message TEXT
);

-- ============================================
-- 12. updated_at 自動更新トリガー
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated
    BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated
    BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ad_accounts_updated
    BEFORE UPDATE ON ad_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_creatives_updated
    BEFORE UPDATE ON creatives FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_updated
    BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_adsets_updated
    BEFORE UPDATE ON adsets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ads_updated
    BEFORE UPDATE ON ads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ad_daily_metrics_updated
    BEFORE UPDATE ON ad_daily_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_submission_presets_updated
    BEFORE UPDATE ON submission_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ad_submissions_updated
    BEFORE UPDATE ON ad_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 13. CV/MCV自動解決VIEW
-- ============================================
CREATE OR REPLACE VIEW ad_daily_conversions AS
SELECT
    m.date,
    m.ad_id,
    a.ad_name,
    a.creative_id,
    c.creative_name,
    ast.adset_id,
    ast.adset_name,
    camp.campaign_id,
    camp.campaign_name,
    camp.account_id,
    acc.account_name,
    acc.project_id,
    m.spend,
    m.impressions,
    m.reach,
    m.clicks,
    m.video_plays,
    m.video_p25_views,
    m.video_p50_views,
    m.video_p75_views,
    m.video_p95_views,
    m.video_p100_views,
    cv_stats.value   AS cv,
    mcv_stats.value  AS mcv,
    cv_conf.display_name  AS cv_name,
    mcv_conf.display_name AS mcv_name
FROM ad_daily_metrics m
JOIN ads a ON a.ad_id = m.ad_id
JOIN adsets ast ON ast.adset_id = a.adset_id
JOIN campaigns camp ON camp.campaign_id = ast.campaign_id
JOIN ad_accounts acc ON acc.account_id = camp.account_id
LEFT JOIN creatives c ON c.id = a.creative_id
LEFT JOIN account_conversion_events cv_conf
    ON cv_conf.account_id = camp.account_id AND cv_conf.event_role = 'cv'
LEFT JOIN ad_action_stats cv_stats
    ON cv_stats.date = m.date AND cv_stats.ad_id = m.ad_id
    AND cv_stats.action_type = cv_conf.meta_action_type
LEFT JOIN account_conversion_events mcv_conf
    ON mcv_conf.account_id = camp.account_id AND mcv_conf.event_role = 'mcv'
LEFT JOIN ad_action_stats mcv_stats
    ON mcv_stats.date = m.date AND mcv_stats.ad_id = m.ad_id
    AND mcv_stats.action_type = mcv_conf.meta_action_type;

-- ============================================
-- 14. アカウントアセット (入稿用: ページ/ピクセル/IG)
-- ============================================
CREATE TABLE account_assets (
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

-- ============================================
-- 15. アカウントルール (値とルール / バリュールール)
-- ============================================
CREATE TABLE account_rules (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('rule', 'value_rule')),
    rule_name TEXT NOT NULL,
    meta_rule_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, rule_type, rule_name)
);

CREATE INDEX idx_account_rules_account ON account_rules(account_id);

-- ============================================
-- 16. 配置プリセット
-- ============================================
CREATE TABLE placement_presets (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_advantage_plus BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 17. 地域ターゲティングプリセット
-- ============================================
CREATE TABLE geo_targeting_presets (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. カスタムオーディエンス設定
-- ============================================
CREATE TABLE custom_audience_sets (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    include_audiences JSONB DEFAULT '[]',
    exclude_audiences JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_audience_sets_account ON custom_audience_sets(account_id);

-- ============================================
-- 19. 入稿プリセット (案件デフォルト)
-- ============================================
CREATE TABLE submission_presets (
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

-- ============================================
-- 20. 入稿バッチ (入口テーブル)
-- ============================================
CREATE TABLE ad_submissions (
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

-- ============================================
-- 21. 入稿キャンペーン
-- ============================================
CREATE TABLE submission_campaigns (
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

-- ============================================
-- 22. 入稿広告セット
-- ============================================
CREATE TABLE submission_adsets (
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

-- ============================================
-- 23. 入稿広告
-- ============================================
CREATE TABLE submission_ads (
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

-- ============================================
-- 24. CR動画ベクトル化テーブル
-- ============================================
-- See migrations/018_cr_embeddings.sql for full DDL
-- Tables: cr_videos (動画DB), cr_scenes (シーンDB)
-- Vectors: halfvec(3072) with HNSW indexes
-- Functions: search_similar_cr_by_video(), search_similar_cr_by_text(), search_similar_scenes()
-- VIEW: v_cr_embedding_status
