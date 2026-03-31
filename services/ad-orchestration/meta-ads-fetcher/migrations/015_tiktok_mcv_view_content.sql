-- Migration 015: TikTok MCV (ViewContent = page_content_view_events) をVIEWに追加
-- ========================================================================
-- TikTok API metric: page_content_view_events → tiktok_action_stats.action_type = 'view_content'
-- Meta API の MCV に対応する指標

-- ============================================================
-- 1. v_tiktok_performance に MCV (view_content) を追加
-- ============================================================

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
  -- CV (conversion = optimization event, typically complete_payment)
  cv_stats.value AS cv,
  cv_stats.cost_per_action AS cost_per_cv,
  -- MCV (view_content = page_content_view_events from pixel)
  mcv_stats.value AS mcv,
  mcv_stats.cost_per_action AS cost_per_mcv,
  -- Result
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
LEFT JOIN tiktok_action_stats mcv_stats
    ON mcv_stats.date = tm.date AND mcv_stats.ad_id = tm.ad_id
    AND mcv_stats.action_type = 'view_content'
LEFT JOIN tiktok_action_stats result_stats
    ON result_stats.date = tm.date AND result_stats.ad_id = tm.ad_id
    AND result_stats.action_type = 'result';

COMMENT ON VIEW v_tiktok_performance IS 'エージェント用: TikTok配信数値+CV(complete_payment)+MCV(view_content)+Result全結合。起点: project_id, account_id, date範囲';

-- ============================================================
-- 2. v_unified_metrics の TikTok部分で MCV = view_content を使用
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
  mcv_stats.value AS mcv
FROM tiktok_daily_metrics tm
JOIN tiktok_ads ta USING (ad_id)
JOIN tiktok_adgroups tg USING (adgroup_id)
JOIN tiktok_campaigns tc USING (campaign_id)
JOIN ad_accounts aa ON tc.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id
LEFT JOIN tiktok_action_stats cv_stats
    ON cv_stats.date = tm.date AND cv_stats.ad_id = tm.ad_id
    AND cv_stats.action_type = 'conversion'
LEFT JOIN tiktok_action_stats mcv_stats
    ON mcv_stats.date = tm.date AND mcv_stats.ad_id = tm.ad_id
    AND mcv_stats.action_type = 'view_content';

COMMENT ON VIEW v_unified_metrics IS 'クロスPF統一VIEW: Meta+TikTok共通指標+CV+MCV。Meta MCV=account_conversion_events設定, TikTok MCV=view_content(page_content_view_events)';

-- ============================================================
-- 3. v_project_daily_summary 再作成
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
  CASE WHEN SUM(cv) > 0 THEN SUM(spend) / SUM(cv) END AS cpa,
  CASE WHEN SUM(mcv) > 0 THEN SUM(spend) / SUM(mcv) END AS cost_per_mcv
FROM v_unified_metrics
GROUP BY date, project_id, project_name, platform;

-- ============================================================
-- 4. v_project_daily_cross_platform 再作成
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
  CASE WHEN SUM(total_mcv) > 0 THEN SUM(total_spend) / SUM(total_mcv) END AS cost_per_mcv,
  json_object_agg(platform, total_spend) AS spend_by_platform
FROM v_project_daily_summary
GROUP BY date, project_id, project_name;
