-- ============================================
-- Migration 002: Normalize ad_insights schema
-- ============================================
-- Changes:
--   1. Create campaigns, adsets, ads dimension tables
--   2. Create ad_daily_metrics fact table (replaces ad_insights for new writes)
--   3. Create ad_action_stats EAV table (replaces fixed CV/MCV columns)
--   4. Create ad_daily_conversions VIEW
--   5. Add notion_page_id to ad_accounts, creatives
--   6. Drop industry/video_url from creatives
--   7. Drop project_name from ad_accounts
--   8. Add PK to account_conversion_events
--   9. Migrate existing data from ad_insights
-- ============================================

-- ============================================
-- Phase 1: Create new dimension tables
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id   TEXT PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    account_id    TEXT NOT NULL REFERENCES ad_accounts(account_id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(account_id);

CREATE TABLE IF NOT EXISTS adsets (
    adset_id    TEXT PRIMARY KEY,
    adset_name  TEXT NOT NULL,
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adsets_campaign ON adsets(campaign_id);

CREATE TABLE IF NOT EXISTS ads (
    ad_id            TEXT PRIMARY KEY,
    ad_name          TEXT NOT NULL,
    adset_id         TEXT NOT NULL REFERENCES adsets(adset_id),
    creative_id      BIGINT REFERENCES creatives(id),
    meta_creative_id TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_adset ON ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_ads_creative ON ads(creative_id);

-- ============================================
-- Phase 2: Create new fact tables
-- ============================================

CREATE TABLE IF NOT EXISTS ad_daily_metrics (
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

CREATE INDEX IF NOT EXISTS idx_ad_daily_metrics_ad ON ad_daily_metrics(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_daily_metrics_date ON ad_daily_metrics(date);

CREATE TABLE IF NOT EXISTS ad_action_stats (
    date          DATE NOT NULL,
    ad_id         TEXT NOT NULL REFERENCES ads(ad_id),
    action_type   TEXT NOT NULL,
    value         INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_ad_action_stats_ad ON ad_action_stats(ad_id);

-- ============================================
-- Phase 3: Fix account_conversion_events
-- ============================================
-- Drop and recreate with proper PK
-- (Keep existing data by using temp table)

CREATE TABLE IF NOT EXISTS account_conversion_events_new (
    account_id       TEXT NOT NULL REFERENCES ad_accounts(account_id),
    event_role       TEXT NOT NULL CHECK (event_role IN ('cv', 'mcv')),
    meta_action_type TEXT NOT NULL,
    display_name     TEXT,
    PRIMARY KEY (account_id, event_role)
);

INSERT INTO account_conversion_events_new (account_id, event_role, meta_action_type, display_name)
SELECT DISTINCT ON (account_id, event_role) account_id, event_role, meta_action_type, display_name
FROM account_conversion_events
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS account_conversion_events;
ALTER TABLE account_conversion_events_new RENAME TO account_conversion_events;

-- ============================================
-- Phase 4: Schema cleanup
-- ============================================

-- Add notion_page_id to ad_accounts (for Notion sync)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ad_accounts' AND column_name='notion_page_id') THEN
        ALTER TABLE ad_accounts ADD COLUMN notion_page_id TEXT UNIQUE;
    END IF;
END $$;

-- Ensure creatives has notion_page_id (may already exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='creatives' AND column_name='notion_page_id') THEN
        ALTER TABLE creatives ADD COLUMN notion_page_id TEXT UNIQUE;
    END IF;
END $$;

-- Drop redundant columns from creatives
ALTER TABLE creatives DROP COLUMN IF EXISTS industry;
ALTER TABLE creatives DROP COLUMN IF EXISTS video_url;

-- Drop redundant column from ad_accounts
ALTER TABLE ad_accounts DROP COLUMN IF EXISTS project_name;

-- ============================================
-- Phase 5: Triggers for new tables
-- ============================================

CREATE TRIGGER trg_campaigns_updated
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_adsets_updated
    BEFORE UPDATE ON adsets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ads_updated
    BEFORE UPDATE ON ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ad_daily_metrics_updated
    BEFORE UPDATE ON ad_daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Phase 6: Migrate existing data from ad_insights
-- ============================================

-- 6a. Populate campaigns
INSERT INTO campaigns (campaign_id, campaign_name, account_id)
SELECT DISTINCT ON (campaign_id) campaign_id, campaign_name, account_id
FROM ad_insights
WHERE campaign_id IS NOT NULL AND account_id IS NOT NULL
ON CONFLICT (campaign_id) DO UPDATE SET campaign_name = EXCLUDED.campaign_name;

-- 6b. Populate adsets
INSERT INTO adsets (adset_id, adset_name, campaign_id)
SELECT DISTINCT ON (adset_id) adset_id, adset_name, campaign_id
FROM ad_insights
WHERE adset_id IS NOT NULL AND campaign_id IS NOT NULL
ON CONFLICT (adset_id) DO UPDATE SET adset_name = EXCLUDED.adset_name;

-- 6c. Populate ads (with creative_id resolution)
INSERT INTO ads (ad_id, ad_name, adset_id)
SELECT DISTINCT ON (ad_id) ad_id, ad_name, adset_id
FROM ad_insights
WHERE ad_id IS NOT NULL AND adset_id IS NOT NULL
ON CONFLICT (ad_id) DO UPDATE SET ad_name = EXCLUDED.ad_name;

-- 6d. Resolve creative_id for ads
UPDATE ads a
SET creative_id = c.id
FROM creatives c
WHERE a.creative_id IS NULL
  AND c.creative_name = (
      SELECT split_part(ai.ad_name, '/', 2)
      FROM ad_insights ai
      WHERE ai.ad_id = a.ad_id
      LIMIT 1
  )
  AND c.creative_name != '';

-- 6e. Populate ad_daily_metrics
INSERT INTO ad_daily_metrics (date, ad_id, spend, impressions, reach, clicks,
    video_plays, video_3s_views, video_p25_views, video_p50_views,
    video_p75_views, video_p95_views, video_p100_views, fetched_at)
SELECT date, ad_id, spend, impressions, reach, inline_link_clicks,
    video_plays, video_3s_views, video_p25_views, video_p50_views,
    video_p75_views, video_p95_views, video_p100_views, fetched_at
FROM ad_insights
WHERE ad_id IS NOT NULL
ON CONFLICT (date, ad_id) DO UPDATE SET
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    reach = EXCLUDED.reach,
    clicks = EXCLUDED.clicks;

-- 6f. Populate ad_action_stats from existing CV/MCV columns
INSERT INTO ad_action_stats (date, ad_id, action_type, value)
SELECT date, ad_id, 'offsite_conversion.fb_pixel_view_content', content_views
FROM ad_insights WHERE content_views > 0 AND ad_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO ad_action_stats (date, ad_id, action_type, value)
SELECT date, ad_id, 'offsite_conversion.fb_pixel_purchase', purchases
FROM ad_insights WHERE purchases > 0 AND ad_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO ad_action_stats (date, ad_id, action_type, value)
SELECT date, ad_id, 'offsite_conversion.fb_pixel_complete_registration', registrations
FROM ad_insights WHERE registrations > 0 AND ad_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO ad_action_stats (date, ad_id, action_type, value)
SELECT date, ad_id, 'offsite_conversion.fb_pixel_lead', leads
FROM ad_insights WHERE leads > 0 AND ad_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- Phase 7: Create convenience VIEW
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
-- CV
LEFT JOIN account_conversion_events cv_conf
    ON cv_conf.account_id = camp.account_id AND cv_conf.event_role = 'cv'
LEFT JOIN ad_action_stats cv_stats
    ON cv_stats.date = m.date AND cv_stats.ad_id = m.ad_id
    AND cv_stats.action_type = cv_conf.meta_action_type
-- MCV
LEFT JOIN account_conversion_events mcv_conf
    ON mcv_conf.account_id = camp.account_id AND mcv_conf.event_role = 'mcv'
LEFT JOIN ad_action_stats mcv_stats
    ON mcv_stats.date = m.date AND mcv_stats.ad_id = m.ad_id
    AND mcv_stats.action_type = mcv_conf.meta_action_type;

-- ============================================
-- Phase 8: Rename old table (keep as backup)
-- ============================================

ALTER TABLE ad_insights RENAME TO ad_insights_legacy;

-- ============================================
-- Phase 9: Update vector search function
-- ============================================

DROP FUNCTION IF EXISTS search_similar_creatives(vector, double precision, integer);

CREATE OR REPLACE FUNCTION search_similar_creatives(
    query_embedding vector(3072),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    creative_name TEXT,
    cr_url TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.creative_name,
        c.cr_url,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM creatives c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
