-- Migration 014: TikTok配信レポートVIEW強化 + 入稿テーブルのマルチプラットフォーム対応
-- ========================================================================

-- ============================================================
-- 1. v_tiktok_performance にCV解決を追加 (Meta版 v_ad_performance と対称)
-- ============================================================
-- TikTokのCV/MCVは tiktok_action_stats から 'conversion'/'result' で取得

DROP VIEW IF EXISTS v_tiktok_performance CASCADE;
CREATE VIEW v_tiktok_performance AS
SELECT
  tm.date,
  tm.ad_id,
  ta.ad_name,
  ta.ad_format,
  ta.landing_page_url,
  ta.video_id,
  tg.adgroup_id,
  tg.adgroup_name,
  tg.optimize_goal,
  tc.campaign_id,
  tc.campaign_name,
  tc.objective_type,
  aa.account_id,
  aa.account_name,
  aa.project_id,
  p.name AS project_name,
  -- Core metrics
  tm.spend,
  tm.impressions,
  tm.reach,
  tm.clicks,
  tm.cpc,
  tm.cpm,
  tm.ctr,
  -- Video
  tm.video_play_actions,
  tm.video_watched_2s,
  tm.video_watched_6s,
  tm.average_video_play,
  tm.video_views_p25,
  tm.video_views_p50,
  tm.video_views_p75,
  tm.video_views_p100,
  -- Social
  tm.likes,
  tm.comments,
  tm.shares,
  tm.follows,
  -- Engagement
  tm.engaged_view,
  tm.engagements,
  tm.engagement_rate,
  -- Conversions (from tiktok_action_stats)
  cv_stats.value AS cv,
  cv_stats.cost_per_action AS cost_per_cv,
  result_stats.value AS results,
  result_stats.cost_per_action AS cost_per_result
FROM tiktok_daily_metrics tm
JOIN tiktok_ads ta USING (ad_id)
JOIN tiktok_adgroups tg USING (adgroup_id)
JOIN tiktok_campaigns tc USING (campaign_id)
JOIN ad_accounts aa ON tc.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id
LEFT JOIN tiktok_action_stats cv_stats
    ON cv_stats.date = tm.date AND cv_stats.ad_id = tm.ad_id
    AND cv_stats.action_type = 'conversion'
LEFT JOIN tiktok_action_stats result_stats
    ON result_stats.date = tm.date AND result_stats.ad_id = tm.ad_id
    AND result_stats.action_type = 'result';

COMMENT ON VIEW v_tiktok_performance IS 'エージェント用: TikTok配信数値+CV/Result全結合。起点: project_id, account_id, date範囲';

-- ============================================================
-- 2. v_unified_metrics にCV列追加
-- ============================================================

DROP VIEW IF EXISTS v_project_daily_cross_platform CASCADE;
DROP VIEW IF EXISTS v_project_daily_summary CASCADE;
DROP VIEW IF EXISTS v_unified_metrics CASCADE;
CREATE VIEW v_unified_metrics AS
-- Meta
SELECT
  'meta'::TEXT AS platform,
  m.date,
  m.ad_id,
  a.ad_name,
  c.campaign_id,
  c.campaign_name,
  aa.account_id,
  aa.account_name,
  aa.project_id,
  p.name AS project_name,
  m.spend,
  m.impressions,
  m.reach,
  m.clicks,
  m.cpc,
  m.cpm,
  m.ctr,
  m.video_plays   AS video_views,
  m.video_3s_views AS short_video_views,
  m.video_p25_views,
  m.video_p50_views,
  m.video_p75_views,
  m.video_p100_views,
  cv_stats.value AS cv,
  mcv_stats.value AS mcv
FROM ad_daily_metrics m
JOIN ads a USING (ad_id)
JOIN adsets s ON a.adset_id = s.adset_id
JOIN campaigns c ON s.campaign_id = c.campaign_id
JOIN ad_accounts aa ON c.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id
LEFT JOIN account_conversion_events cv_conf
    ON cv_conf.account_id = c.account_id AND cv_conf.event_role = 'cv'
LEFT JOIN ad_action_stats cv_stats
    ON cv_stats.date = m.date AND cv_stats.ad_id = m.ad_id
    AND cv_stats.action_type = cv_conf.meta_action_type
LEFT JOIN account_conversion_events mcv_conf
    ON mcv_conf.account_id = c.account_id AND mcv_conf.event_role = 'mcv'
LEFT JOIN ad_action_stats mcv_stats
    ON mcv_stats.date = m.date AND mcv_stats.ad_id = m.ad_id
    AND mcv_stats.action_type = mcv_conf.meta_action_type

UNION ALL

-- TikTok
SELECT
  'tiktok'::TEXT AS platform,
  tm.date,
  tm.ad_id,
  ta.ad_name,
  tc.campaign_id,
  tc.campaign_name,
  aa.account_id,
  aa.account_name,
  aa.project_id,
  p.name AS project_name,
  tm.spend,
  tm.impressions,
  tm.reach,
  tm.clicks,
  tm.cpc,
  tm.cpm,
  tm.ctr,
  tm.video_play_actions  AS video_views,
  tm.video_watched_2s    AS short_video_views,
  tm.video_views_p25,
  tm.video_views_p50,
  tm.video_views_p75,
  tm.video_views_p100,
  cv_stats.value AS cv,
  result_stats.value AS mcv
FROM tiktok_daily_metrics tm
JOIN tiktok_ads ta USING (ad_id)
JOIN tiktok_adgroups tg USING (adgroup_id)
JOIN tiktok_campaigns tc USING (campaign_id)
JOIN ad_accounts aa ON tc.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id
LEFT JOIN tiktok_action_stats cv_stats
    ON cv_stats.date = tm.date AND cv_stats.ad_id = tm.ad_id
    AND cv_stats.action_type = 'conversion'
LEFT JOIN tiktok_action_stats result_stats
    ON result_stats.date = tm.date AND result_stats.ad_id = tm.ad_id
    AND result_stats.action_type = 'result';

COMMENT ON VIEW v_unified_metrics IS 'クロスPF統一VIEW: Meta+TikTok共通指標+CV。platformカラムで識別。short_video_views=Meta3秒/TikTok2秒';

-- ============================================================
-- 3. v_project_daily_summary を再作成 (CV追加)
-- ============================================================

CREATE VIEW v_project_daily_summary AS
SELECT
  date,
  project_id,
  project_name,
  platform,
  SUM(spend) AS total_spend,
  SUM(impressions) AS total_impressions,
  SUM(reach) AS total_reach,
  SUM(clicks) AS total_clicks,
  CASE WHEN SUM(clicks) > 0 THEN SUM(spend) / SUM(clicks) END AS avg_cpc,
  CASE WHEN SUM(impressions) > 0 THEN SUM(spend) / SUM(impressions) * 1000 END AS avg_cpm,
  CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::NUMERIC / SUM(impressions) END AS avg_ctr,
  SUM(video_views) AS total_video_views,
  SUM(cv) AS total_cv,
  SUM(mcv) AS total_mcv,
  CASE WHEN SUM(cv) > 0 THEN SUM(spend) / SUM(cv) END AS cpa
FROM v_unified_metrics
GROUP BY date, project_id, project_name, platform;

-- ============================================================
-- 4. v_project_daily_cross_platform を再作成 (CV追加)
-- ============================================================

CREATE VIEW v_project_daily_cross_platform AS
SELECT
  date,
  project_id,
  project_name,
  SUM(total_spend) AS total_spend,
  SUM(total_impressions) AS total_impressions,
  SUM(total_reach) AS total_reach,
  SUM(total_clicks) AS total_clicks,
  CASE WHEN SUM(total_clicks) > 0 THEN SUM(total_spend) / SUM(total_clicks) END AS avg_cpc,
  CASE WHEN SUM(total_impressions) > 0 THEN SUM(total_spend) / SUM(total_impressions) * 1000 END AS avg_cpm,
  CASE WHEN SUM(total_impressions) > 0 THEN SUM(total_clicks)::NUMERIC / SUM(total_impressions) END AS avg_ctr,
  SUM(total_video_views) AS total_video_views,
  SUM(total_cv) AS total_cv,
  SUM(total_mcv) AS total_mcv,
  CASE WHEN SUM(total_cv) > 0 THEN SUM(total_spend) / SUM(total_cv) END AS cpa,
  json_object_agg(platform, total_spend) AS spend_by_platform
FROM v_project_daily_summary
GROUP BY date, project_id, project_name;

-- ============================================================
-- 5. 入稿テーブルにplatformカラム追加
-- ============================================================

-- ad_submissions に platform 追加 (Meta/TikTok判別)
ALTER TABLE ad_submissions
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta' NOT NULL;

-- submission_presets に platform 追加
ALTER TABLE submission_presets
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta' NOT NULL;

-- submission_presets の UNIQUE制約を更新 (project + preset_name + platform)
-- 既存のUNIQUE制約を削除してから再作成
DO $$
BEGIN
  -- Drop old unique if exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_presets_project_id_preset_name_key') THEN
    ALTER TABLE submission_presets DROP CONSTRAINT submission_presets_project_id_preset_name_key;
  END IF;
  -- Add new unique with platform
  ALTER TABLE submission_presets ADD CONSTRAINT submission_presets_project_platform_name_key
    UNIQUE (project_id, platform, preset_name);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================
-- 6. TikTok入稿固有カラム追加
-- ============================================================

-- submission_campaigns に TikTok固有フィールド
ALTER TABLE submission_campaigns
  ADD COLUMN IF NOT EXISTS tiktok_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS objective_type TEXT;  -- TikTok: TRAFFIC, CONVERSIONS etc.

-- submission_adsets に TikTok固有フィールド (adgroup相当)
ALTER TABLE submission_adsets
  ADD COLUMN IF NOT EXISTS tiktok_adgroup_id TEXT,
  ADD COLUMN IF NOT EXISTS placement_type TEXT,        -- PLACEMENT_TYPE_AUTOMATIC etc.
  ADD COLUMN IF NOT EXISTS optimize_goal_tiktok TEXT,  -- CONVERT, CLICK, REACH
  ADD COLUMN IF NOT EXISTS bid_type_tiktok TEXT,       -- BID_TYPE_NO_BID etc.
  ADD COLUMN IF NOT EXISTS pixel_id_tiktok TEXT,       -- TikTok pixel ID
  ADD COLUMN IF NOT EXISTS location_ids JSONB;         -- TikTok location IDs [392]

-- submission_ads に TikTok固有フィールド
ALTER TABLE submission_ads
  ADD COLUMN IF NOT EXISTS tiktok_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_video_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_format TEXT,        -- SINGLE_VIDEO, SINGLE_IMAGE
  ADD COLUMN IF NOT EXISTS ad_text TEXT,           -- TikTok ad caption
  ADD COLUMN IF NOT EXISTS display_name_tiktok TEXT, -- TikTok display name
  ADD COLUMN IF NOT EXISTS call_to_action_tiktok TEXT; -- LEARN_MORE, SHOP_NOW etc.

-- ============================================================
-- 7. TikTok入稿プリセット用: submission_presets に TikTok固有カラム
-- ============================================================

ALTER TABLE submission_presets
  ADD COLUMN IF NOT EXISTS tiktok_placement_type TEXT DEFAULT 'PLACEMENT_TYPE_AUTOMATIC',
  ADD COLUMN IF NOT EXISTS tiktok_optimize_goal TEXT DEFAULT 'CONVERT',
  ADD COLUMN IF NOT EXISTS tiktok_bid_type TEXT DEFAULT 'BID_TYPE_NO_BID',
  ADD COLUMN IF NOT EXISTS tiktok_billing_event TEXT DEFAULT 'OCPM',
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_location_ids JSONB DEFAULT '[392]',  -- Japan
  ADD COLUMN IF NOT EXISTS default_ad_text TEXT,
  ADD COLUMN IF NOT EXISTS default_display_name TEXT,
  ADD COLUMN IF NOT EXISTS default_call_to_action TEXT DEFAULT 'LEARN_MORE';

-- ============================================================
-- 8. v_submission_context を再作成 (platform対応)
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
  -- Meta固有
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
  -- TikTok固有
  sp.tiktok_placement_type,
  sp.tiktok_optimize_goal,
  sp.tiktok_bid_type,
  sp.tiktok_billing_event,
  sp.tiktok_pixel_id,
  sp.tiktok_location_ids,
  sp.default_ad_text,
  sp.default_display_name,
  sp.default_call_to_action,
  -- Assets (Meta)
  fp.meta_asset_id AS facebook_page_id,
  fp.asset_name AS facebook_page_name,
  px.meta_asset_id AS pixel_meta_id,
  px.asset_name AS pixel_name,
  ig.meta_asset_id AS instagram_account_id,
  ig.asset_name AS instagram_account_name,
  -- Rules
  rl.meta_rule_id AS rule_meta_id,
  rl.rule_name,
  vrl.meta_rule_id AS value_rule_meta_id,
  vrl.rule_name AS value_rule_name,
  -- Geo/Placement
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

COMMENT ON VIEW v_submission_context IS 'エージェント用: 入稿プリセット+アセット+ターゲティング全結合。platform対応(meta/tiktok)';
