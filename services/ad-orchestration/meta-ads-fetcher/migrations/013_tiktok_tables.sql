-- Migration 013: TikTok広告テーブル + クロスプラットフォーム統一VIEW
-- Meta側テーブルと対称構造で並列配置

-- ============================================================
-- 1. ad_accounts に platform カラム追加
-- ============================================================
ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta' NOT NULL;

-- ============================================================
-- 2. TikTok 階層テーブル (Campaign > AdGroup > Ad)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_campaigns (
  campaign_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ad_accounts(account_id),
  campaign_name TEXT,
  objective_type TEXT,      -- TRAFFIC, CONVERSIONS, APP_INSTALL, etc.
  budget_mode TEXT,         -- BUDGET_MODE_DAY, BUDGET_MODE_TOTAL, BUDGET_MODE_INFINITE
  budget NUMERIC(12,2),
  status TEXT,              -- ENABLE, DISABLE, DELETE
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiktok_adgroups (
  adgroup_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES tiktok_campaigns(campaign_id),
  adgroup_name TEXT,
  placement_type TEXT,      -- PLACEMENT_TYPE_AUTOMATIC, PLACEMENT_TYPE_NORMAL
  bid_type TEXT,            -- BID_TYPE_NO_BID, BID_TYPE_CPC, etc.
  optimize_goal TEXT,       -- CONVERT, CLICK, REACH, etc.
  budget NUMERIC(12,2),
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiktok_ads (
  ad_id TEXT PRIMARY KEY,
  adgroup_id TEXT NOT NULL REFERENCES tiktok_adgroups(adgroup_id),
  ad_name TEXT,
  ad_format TEXT,           -- SINGLE_VIDEO, SINGLE_IMAGE, etc.
  landing_page_url TEXT,
  call_to_action TEXT,
  video_id TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TikTok 日次メトリクス (Meta側 ad_daily_metrics と対称)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_daily_metrics (
  date DATE NOT NULL,
  ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
  -- Core metrics (共通)
  spend NUMERIC(12,2),           -- JPYそのまま (string→numericに変換して格納)
  impressions INT,
  reach INT,
  clicks INT,
  cpc NUMERIC(10,4),
  cpm NUMERIC(10,4),
  ctr NUMERIC(8,6),
  -- Video metrics
  video_play_actions INT,        -- 総再生数
  video_watched_2s INT,          -- 2秒以上視聴 (Meta: 3秒=thruplay)
  video_watched_6s INT,          -- 6秒以上視聴
  average_video_play NUMERIC(10,2), -- 平均視聴時間(秒)
  video_views_p25 INT,           -- 25%視聴完了
  video_views_p50 INT,           -- 50%視聴完了
  video_views_p75 INT,           -- 75%視聴完了
  video_views_p100 INT,          -- 100%視聴完了
  -- Social metrics (TikTok固有)
  likes INT,
  comments INT,
  shares INT,
  follows INT,
  -- Engagement
  engaged_view INT,
  engagements INT,
  engagement_rate NUMERIC(8,6),
  -- System
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (date, ad_id)
);

-- ============================================================
-- 4. TikTok コンバージョン (Meta側 ad_action_stats と対称)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_action_stats (
  date DATE NOT NULL,
  ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
  action_type TEXT NOT NULL,     -- 'conversion', 'result', 'skan_conversion' etc.
  value INT,
  cost_per_action NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (date, ad_id, action_type)
);

-- ============================================================
-- 5. Layer 1: TikTok プラットフォーム別 VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_tiktok_performance AS
SELECT
  tm.date,
  tm.ad_id,
  ta.ad_name,
  ta.ad_format,
  ta.landing_page_url,
  tg.adgroup_id,
  tg.adgroup_name,
  tc.campaign_id,
  tc.campaign_name,
  tc.objective_type,
  aa.account_id,
  aa.account_name,
  p.id AS project_id,
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
  tm.engagement_rate
FROM tiktok_daily_metrics tm
JOIN tiktok_ads ta USING (ad_id)
JOIN tiktok_adgroups tg USING (adgroup_id)
JOIN tiktok_campaigns tc USING (campaign_id)
JOIN ad_accounts aa ON tc.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id;

-- ============================================================
-- 6. Layer 2: クロスプラットフォーム統一 VIEW (共通指標)
-- ============================================================
-- Note: reach合算はプラットフォーム間のユーザー重複を考慮できない
-- Note: Meta video_3s_views ≠ TikTok video_watched_2s (定義差異あり)

CREATE OR REPLACE VIEW v_unified_metrics AS
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
  m.video_3s_views AS short_video_views,  -- Meta: 3秒
  m.video_p25_views,
  m.video_p50_views,
  m.video_p75_views,
  m.video_p100_views
FROM ad_daily_metrics m
JOIN ads a USING (ad_id)
JOIN adsets s ON a.adset_id = s.adset_id
JOIN campaigns c ON s.campaign_id = c.campaign_id
JOIN ad_accounts aa ON c.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id

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
  tm.video_watched_2s    AS short_video_views,  -- TikTok: 2秒
  tm.video_views_p25,
  tm.video_views_p50,
  tm.video_views_p75,
  tm.video_views_p100
FROM tiktok_daily_metrics tm
JOIN tiktok_ads ta USING (ad_id)
JOIN tiktok_adgroups tg USING (adgroup_id)
JOIN tiktok_campaigns tc USING (campaign_id)
JOIN ad_accounts aa ON tc.account_id = aa.account_id
LEFT JOIN projects p ON aa.project_id = p.id;

-- ============================================================
-- 7. Layer 3: プロジェクト日次サマリー (プラットフォーム別)
-- ============================================================

CREATE OR REPLACE VIEW v_project_daily_summary AS
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
  SUM(video_views) AS total_video_views
FROM v_unified_metrics
GROUP BY date, project_id, project_name, platform;

-- ============================================================
-- 8. Layer 3: プロジェクト日次クロスプラットフォーム合算
-- ============================================================
-- CAUTION: reachの合算はプラットフォーム間ユーザー重複があるため正確ではない

CREATE OR REPLACE VIEW v_project_daily_cross_platform AS
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
  json_object_agg(platform, total_spend) AS spend_by_platform
FROM v_project_daily_summary
GROUP BY date, project_id, project_name;

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tiktok_campaigns_account ON tiktok_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_adgroups_campaign ON tiktok_adgroups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_ads_adgroup ON tiktok_ads(adgroup_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_daily_metrics_date ON tiktok_daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_tiktok_action_stats_date ON tiktok_action_stats(date);
