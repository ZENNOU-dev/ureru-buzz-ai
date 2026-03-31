-- Migration 016: TikTok専用入稿テーブル + 既存submission_*のTikTokカラム削除
-- ========================================================================
-- Meta入稿(submission_*)とTikTok入稿(tiktok_sub_*)を完全分離

-- ============================================================
-- 1. TikTok入稿プリセット
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_submission_presets (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    preset_name TEXT NOT NULL,
    account_id TEXT REFERENCES ad_accounts(account_id),
    campaign_type TEXT NOT NULL DEFAULT 'manual' CHECK (campaign_type IN ('manual', 'smart_plus')),
    -- Campaign defaults
    objective_type TEXT DEFAULT 'CONVERSIONS',
    budget_mode TEXT DEFAULT 'BUDGET_MODE_DAY',
    -- Adgroup defaults
    pixel_id TEXT,
    optimization_event TEXT DEFAULT 'SHOPPING',
    optimize_goal TEXT DEFAULT 'CONVERT',
    bid_type TEXT DEFAULT 'BID_TYPE_NO_BID',
    billing_event TEXT DEFAULT 'OCPM',
    placement_type TEXT DEFAULT 'PLACEMENT_TYPE_NORMAL',
    placements JSONB DEFAULT '["TIKTOK"]',
    location_ids JSONB DEFAULT '[392]',
    languages JSONB DEFAULT '["ja"]',
    gender TEXT,  -- GENDER_MALE, GENDER_FEMALE, or NULL for all
    age_min INT DEFAULT 18,
    age_max INT DEFAULT 55,
    -- Attribution
    attribution_click_window TEXT DEFAULT '1DAY',
    attribution_view_window TEXT DEFAULT 'OFF',
    event_counting TEXT DEFAULT 'UNIQUE',
    -- Social settings
    comment_disabled BOOLEAN DEFAULT true,
    video_download_disabled BOOLEAN DEFAULT true,
    share_disabled BOOLEAN DEFAULT true,
    -- Ad defaults
    default_ad_text TEXT,
    default_display_name TEXT,
    default_call_to_action TEXT DEFAULT 'LEARN_MORE',
    identity_id TEXT,
    identity_type TEXT DEFAULT 'CUSTOMIZED_USER',
    auto_enhance_disabled BOOLEAN DEFAULT true,
    -- Status defaults
    campaign_status TEXT DEFAULT 'DISABLE',
    adgroup_status TEXT DEFAULT 'ENABLE',
    ad_status TEXT DEFAULT 'ENABLE',
    --
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, campaign_type, preset_name)
);

CREATE INDEX idx_tiktok_sub_presets_project ON tiktok_submission_presets(project_id);

-- ============================================================
-- 2. TikTok入稿バッチヘッダー
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_submissions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
    preset_id BIGINT REFERENCES tiktok_submission_presets(id),
    campaign_type TEXT NOT NULL DEFAULT 'manual' CHECK (campaign_type IN ('manual', 'smart_plus')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'submitting', 'completed', 'partial_error', 'error')),
    request_text TEXT,
    requested_by TEXT,
    submitted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tiktok_submissions_project ON tiktok_submissions(project_id);
CREATE INDEX idx_tiktok_submissions_status ON tiktok_submissions(status);

-- ============================================================
-- 3. TikTok入稿キャンペーン
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_sub_campaigns (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES tiktok_submissions(id) ON DELETE CASCADE,
    campaign_name TEXT NOT NULL,
    objective_type TEXT NOT NULL DEFAULT 'CONVERSIONS',
    budget_mode TEXT DEFAULT 'BUDGET_MODE_DAY',
    budget NUMERIC(12, 2),  -- CBO日予算 (JPY)
    status TEXT DEFAULT 'DISABLE',
    tiktok_campaign_id TEXT,  -- API返却値
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tiktok_sub_campaigns_submission ON tiktok_sub_campaigns(submission_id);

-- ============================================================
-- 4. TikTok入稿広告グループ
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_sub_adgroups (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES tiktok_sub_campaigns(id) ON DELETE CASCADE,
    adgroup_name TEXT NOT NULL,
    -- Targeting & Placement
    placement_type TEXT DEFAULT 'PLACEMENT_TYPE_NORMAL',
    placements JSONB DEFAULT '["TIKTOK"]',
    location_ids JSONB DEFAULT '[392]',
    languages JSONB DEFAULT '["ja"]',
    gender TEXT,  -- GENDER_MALE, GENDER_FEMALE, NULL=all
    age_groups JSONB,  -- ["AGE_18_24", "AGE_25_34", ...]
    -- Audience
    audience_suggestion JSONB,  -- Smart+用: 媒体への提案
    custom_audiences JSONB DEFAULT '[]',  -- 手動用: include/exclude
    -- Optimization
    optimize_goal TEXT DEFAULT 'CONVERT',
    bid_type TEXT DEFAULT 'BID_TYPE_NO_BID',
    bid_amount NUMERIC(12, 2),  -- tCPA時のみ
    billing_event TEXT DEFAULT 'OCPM',
    pixel_id TEXT,
    optimization_event TEXT DEFAULT 'SHOPPING',
    -- Budget & Schedule
    budget_mode TEXT DEFAULT 'BUDGET_MODE_DAY',
    budget NUMERIC(12, 2),  -- 非CBO時
    schedule_type TEXT DEFAULT 'SCHEDULE_START_END',
    schedule_start_time TEXT,  -- ISO format "2026-03-24 00:00:00"
    schedule_end_time TEXT,
    -- Attribution
    attribution_click_window TEXT DEFAULT '1DAY',
    attribution_view_window TEXT DEFAULT 'OFF',
    event_counting TEXT DEFAULT 'UNIQUE',
    -- Social
    comment_disabled BOOLEAN DEFAULT true,
    video_download_disabled BOOLEAN DEFAULT true,
    share_disabled BOOLEAN DEFAULT true,
    -- Status
    status TEXT DEFAULT 'ENABLE',
    tiktok_adgroup_id TEXT,  -- API返却値
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tiktok_sub_adgroups_campaign ON tiktok_sub_adgroups(campaign_id);

-- ============================================================
-- 5. TikTok入稿広告
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_sub_ads (
    id BIGSERIAL PRIMARY KEY,
    adgroup_id BIGINT NOT NULL REFERENCES tiktok_sub_adgroups(id) ON DELETE CASCADE,
    ad_name TEXT NOT NULL,
    -- Creative
    ad_format TEXT DEFAULT 'SINGLE_VIDEO',
    ad_text TEXT,
    display_name TEXT,
    call_to_action TEXT DEFAULT 'LEARN_MORE',
    landing_page_url TEXT,
    -- Identity
    identity_id TEXT,
    identity_type TEXT DEFAULT 'CUSTOMIZED_USER',
    -- CR references (Supabase creatives テーブルのID)
    creative_ids JSONB NOT NULL DEFAULT '[]',  -- [1, 2, 3] Smart+は複数, 手動は1つ
    -- Upload results
    tiktok_video_ids JSONB DEFAULT '[]',  -- ["video_id_1", "video_id_2"] アップロード後
    -- Settings
    auto_enhance_disabled BOOLEAN DEFAULT true,
    interactive_addon_config JSONB,  -- オプション: インタラクティブアドオン設定
    -- Status
    status TEXT DEFAULT 'ENABLE',
    tiktok_ad_id TEXT,  -- API返却値
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tiktok_sub_ads_adgroup ON tiktok_sub_ads(adgroup_id);

-- ============================================================
-- 6. creatives テーブルに tiktok_video_ids 追加
-- ============================================================

ALTER TABLE creatives ADD COLUMN IF NOT EXISTS tiktok_video_ids JSONB DEFAULT '{}';
COMMENT ON COLUMN creatives.tiktok_video_ids IS 'アカウント別TikTok動画IDキャッシュ。{advertiser_id: video_id}形式。再アップロード防止';

-- ============================================================
-- 7. トリガー
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tiktok_submission_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tiktok_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. 既存submission_*テーブルのTikTok固有カラム削除
-- ============================================================

-- v_submission_contextが依存しているので先にDROP
DROP VIEW IF EXISTS v_submission_context CASCADE;

-- submission_presets: TikTok固有カラム削除
ALTER TABLE submission_presets
    DROP COLUMN IF EXISTS tiktok_placement_type,
    DROP COLUMN IF EXISTS tiktok_optimize_goal,
    DROP COLUMN IF EXISTS tiktok_bid_type,
    DROP COLUMN IF EXISTS tiktok_billing_event,
    DROP COLUMN IF EXISTS tiktok_pixel_id,
    DROP COLUMN IF EXISTS tiktok_location_ids,
    DROP COLUMN IF EXISTS default_ad_text,
    DROP COLUMN IF EXISTS default_display_name,
    DROP COLUMN IF EXISTS default_call_to_action;

-- submission_campaigns: TikTok固有カラム削除
ALTER TABLE submission_campaigns
    DROP COLUMN IF EXISTS tiktok_campaign_id,
    DROP COLUMN IF EXISTS objective_type;

-- submission_adsets: TikTok固有カラム削除
ALTER TABLE submission_adsets
    DROP COLUMN IF EXISTS tiktok_adgroup_id,
    DROP COLUMN IF EXISTS placement_type,
    DROP COLUMN IF EXISTS optimize_goal_tiktok,
    DROP COLUMN IF EXISTS bid_type_tiktok,
    DROP COLUMN IF EXISTS pixel_id_tiktok,
    DROP COLUMN IF EXISTS location_ids;

-- submission_ads: TikTok固有カラム削除
ALTER TABLE submission_ads
    DROP COLUMN IF EXISTS tiktok_ad_id,
    DROP COLUMN IF EXISTS tiktok_video_id,
    DROP COLUMN IF EXISTS ad_format,
    DROP COLUMN IF EXISTS ad_text,
    DROP COLUMN IF EXISTS display_name_tiktok,
    DROP COLUMN IF EXISTS call_to_action_tiktok;

-- ============================================================
-- 9. v_submission_context 再構築 (TikTokカラム削除分を反映)
-- ============================================================

DROP VIEW IF EXISTS v_submission_context CASCADE;
CREATE VIEW v_submission_context AS
SELECT
  sp.id AS preset_id,
  sp.preset_name,
  sp.platform,
  sp.project_id,
  p.name AS project_name,
  sp.account_id,
  aa.account_name,
  sp.campaign_objective,
  sp.bid_strategy,
  sp.optimization_goal,
  sp.is_asc,
  sp.gender,
  sp.age_min,
  sp.age_max,
  sp.default_title,
  sp.default_body,
  sp.default_description,
  sp.creative_type,
  sp.campaign_status,
  sp.adset_status,
  sp.ad_status,
  fp.meta_asset_id AS facebook_page_id,
  fp.asset_name AS facebook_page_name,
  px.meta_asset_id AS pixel_meta_id,
  px.asset_name AS pixel_name,
  ig.meta_asset_id AS instagram_account_id,
  ig.asset_name AS instagram_account_name,
  rl.meta_rule_id AS rule_meta_id,
  rl.rule_name,
  vrl.meta_rule_id AS value_rule_meta_id,
  vrl.rule_name AS value_rule_name,
  gp.name AS geo_preset_name,
  gp.config AS geo_config,
  pp.name AS placement_preset_name,
  pp.is_advantage_plus,
  pp.config AS placement_config
FROM submission_presets sp
JOIN projects p ON sp.project_id = p.id
LEFT JOIN ad_accounts aa ON sp.account_id = aa.account_id
LEFT JOIN account_assets fp ON sp.facebook_page_id = fp.id
LEFT JOIN account_assets px ON sp.pixel_id = px.id
LEFT JOIN account_assets ig ON sp.instagram_account_id = ig.id
LEFT JOIN account_rules rl ON sp.rule_id = rl.id
LEFT JOIN account_rules vrl ON sp.value_rule_id = vrl.id
LEFT JOIN geo_targeting_presets gp ON sp.geo_preset_id = gp.id
LEFT JOIN placement_presets pp ON sp.placement_preset_id = pp.id;

COMMENT ON VIEW v_submission_context IS 'エージェント用: Meta入稿プリセット+アセット+ターゲティング全結合。Meta専用';

-- ============================================================
-- 10. TikTok入稿コンテキストVIEW
-- ============================================================

CREATE OR REPLACE VIEW v_tiktok_submission_context AS
SELECT
  tp.id AS preset_id,
  tp.preset_name,
  tp.campaign_type,
  tp.project_id,
  p.name AS project_name,
  tp.account_id,
  aa.account_name,
  tp.objective_type,
  tp.pixel_id,
  tp.optimization_event,
  tp.optimize_goal,
  tp.bid_type,
  tp.billing_event,
  tp.placement_type,
  tp.placements,
  tp.location_ids,
  tp.languages,
  tp.gender,
  tp.age_min,
  tp.age_max,
  tp.attribution_click_window,
  tp.attribution_view_window,
  tp.event_counting,
  tp.comment_disabled,
  tp.video_download_disabled,
  tp.share_disabled,
  tp.default_ad_text,
  tp.default_display_name,
  tp.default_call_to_action,
  tp.identity_id,
  tp.identity_type,
  tp.auto_enhance_disabled,
  tp.campaign_status,
  tp.adgroup_status,
  tp.ad_status
FROM tiktok_submission_presets tp
JOIN projects p ON tp.project_id = p.id
LEFT JOIN ad_accounts aa ON tp.account_id = aa.account_id;

COMMENT ON VIEW v_tiktok_submission_context IS 'エージェント用: TikTok入稿プリセット全結合。campaign_typeでSmart+/手動判別';
