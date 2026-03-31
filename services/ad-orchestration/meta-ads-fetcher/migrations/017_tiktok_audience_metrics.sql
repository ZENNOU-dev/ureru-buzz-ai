-- Migration 017: TikTok オーディエンス・配信面別メトリクス
-- ========================================================================
-- AUDIENCE reportで取得できるディメンション別パフォーマンスデータ
-- 各テーブルは (date, ad_id, dimension_value) で一意

-- ============================================================
-- 1. 配信面別 (placement)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_metrics_by_placement (
    date DATE NOT NULL,
    ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
    placement TEXT NOT NULL,  -- PLACEMENT_TIKTOK, PLACEMENT_PANGLE, PLACEMENT_GLOBAL_APP_BUNDLE
    spend NUMERIC(12,2),
    impressions INT,
    reach INT,
    clicks INT,
    cpc NUMERIC(10,4),
    cpm NUMERIC(10,4),
    ctr NUMERIC(8,6),
    conversion INT,
    cost_per_conversion NUMERIC(10,4),
    result INT,
    cost_per_result NUMERIC(10,4),
    video_play_actions INT,
    video_watched_2s INT,
    video_views_p25 INT,
    video_views_p50 INT,
    video_views_p75 INT,
    video_views_p100 INT,
    engaged_view INT,
    likes INT,
    comments INT,
    shares INT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, placement)
);

-- ============================================================
-- 2. 年齢別 (age)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_metrics_by_age (
    date DATE NOT NULL,
    ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
    age_group TEXT NOT NULL,  -- AGE_13_17, AGE_18_24, AGE_25_34, AGE_35_44, AGE_45_54, AGE_55_100
    spend NUMERIC(12,2),
    impressions INT,
    reach INT,
    clicks INT,
    cpc NUMERIC(10,4),
    cpm NUMERIC(10,4),
    ctr NUMERIC(8,6),
    conversion INT,
    cost_per_conversion NUMERIC(10,4),
    video_play_actions INT,
    video_watched_2s INT,
    engaged_view INT,
    likes INT,
    comments INT,
    shares INT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, age_group)
);

-- ============================================================
-- 3. 性別 (gender)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_metrics_by_gender (
    date DATE NOT NULL,
    ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
    gender TEXT NOT NULL,  -- MALE, FEMALE, NONE
    spend NUMERIC(12,2),
    impressions INT,
    reach INT,
    clicks INT,
    cpc NUMERIC(10,4),
    cpm NUMERIC(10,4),
    ctr NUMERIC(8,6),
    conversion INT,
    cost_per_conversion NUMERIC(10,4),
    video_play_actions INT,
    video_watched_2s INT,
    engaged_view INT,
    likes INT,
    comments INT,
    shares INT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, gender)
);

-- ============================================================
-- 4. OS別 (platform)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_metrics_by_platform (
    date DATE NOT NULL,
    ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
    platform TEXT NOT NULL,  -- ANDROID, IPHONE, UNKNOWN
    spend NUMERIC(12,2),
    impressions INT,
    reach INT,
    clicks INT,
    cpc NUMERIC(10,4),
    cpm NUMERIC(10,4),
    ctr NUMERIC(8,6),
    conversion INT,
    cost_per_conversion NUMERIC(10,4),
    video_play_actions INT,
    video_watched_2s INT,
    engaged_view INT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, platform)
);

-- ============================================================
-- 5. 地域別 (province)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_metrics_by_province (
    date DATE NOT NULL,
    ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
    province_id TEXT NOT NULL,  -- TikTok province ID
    spend NUMERIC(12,2),
    impressions INT,
    reach INT,
    clicks INT,
    cpc NUMERIC(10,4),
    cpm NUMERIC(10,4),
    ctr NUMERIC(8,6),
    conversion INT,
    cost_per_conversion NUMERIC(10,4),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, province_id)
);

-- ============================================================
-- 6. 通信環境別 (ac)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_metrics_by_ac (
    date DATE NOT NULL,
    ad_id TEXT NOT NULL REFERENCES tiktok_ads(ad_id),
    ac TEXT NOT NULL,  -- WIFI, 2G, 3G, 4G, 5G, UNKNOWN
    spend NUMERIC(12,2),
    impressions INT,
    reach INT,
    clicks INT,
    cpc NUMERIC(10,4),
    cpm NUMERIC(10,4),
    ctr NUMERIC(8,6),
    conversion INT,
    cost_per_conversion NUMERIC(10,4),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, ad_id, ac)
);

-- ============================================================
-- 7. インデックス
-- ============================================================

CREATE INDEX idx_tiktok_by_placement_date ON tiktok_metrics_by_placement(date);
CREATE INDEX idx_tiktok_by_age_date ON tiktok_metrics_by_age(date);
CREATE INDEX idx_tiktok_by_gender_date ON tiktok_metrics_by_gender(date);
CREATE INDEX idx_tiktok_by_platform_date ON tiktok_metrics_by_platform(date);
CREATE INDEX idx_tiktok_by_province_date ON tiktok_metrics_by_province(date);
CREATE INDEX idx_tiktok_by_ac_date ON tiktok_metrics_by_ac(date);
