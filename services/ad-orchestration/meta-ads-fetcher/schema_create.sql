CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ad_accounts (
    account_id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL,
    project_name TEXT,
    business_manager_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    timezone TEXT DEFAULT 'Asia/Tokyo',
    is_target BOOLEAN DEFAULT false,
    last_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_insights (
    id BIGSERIAL PRIMARY KEY,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    account_id TEXT REFERENCES ad_accounts(account_id),
    account_name TEXT,
    campaign_name TEXT,
    campaign_id TEXT,
    adset_name TEXT,
    adset_id TEXT,
    ad_name TEXT,
    ad_id TEXT,
    creative_name TEXT,
    spend NUMERIC DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    inline_link_clicks INTEGER DEFAULT 0,
    content_views INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    video_plays INTEGER DEFAULT 0,
    video_3s_views INTEGER DEFAULT 0,
    video_p25_views INTEGER DEFAULT 0,
    video_p50_views INTEGER DEFAULT 0,
    video_p75_views INTEGER DEFAULT 0,
    video_p95_views INTEGER DEFAULT 0,
    video_p100_views INTEGER DEFAULT 0,
    registrations INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    UNIQUE(date, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_insights_date ON ad_insights(date);
CREATE INDEX IF NOT EXISTS idx_ad_insights_account ON ad_insights(account_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_ad ON ad_insights(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_creative ON ad_insights(creative_name);
CREATE INDEX IF NOT EXISTS idx_ad_insights_fetched ON ad_insights(fetched_at);

CREATE TABLE IF NOT EXISTS creatives (
    id BIGSERIAL PRIMARY KEY,
    creative_name TEXT UNIQUE NOT NULL,
    video_url TEXT,
    thumbnail_url TEXT,
    description TEXT,
    embedding vector(3072),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fetch_log (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL,
    rows_fetched INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_accounts_updated
    BEFORE UPDATE ON ad_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_creatives_updated
    BEFORE UPDATE ON creatives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION search_similar_creatives(
    query_embedding vector(3072),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    creative_name TEXT,
    video_url TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.creative_name,
        c.video_url,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM creatives c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
