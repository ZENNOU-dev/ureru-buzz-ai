-- Migration 019: 競合CR(動画分析PRO)テーブル
-- ============================================
-- dpro_items: DPro広告アイテム（競合CRマスタ）
-- dpro_videos: 動画分析結果（シーン検出+OCR+書き起こし+embedding）
-- dpro_scenes: シーン単位データ
-- ============================================

-- ============================================
-- 1. dpro_items — 競合CRマスタ
-- ============================================
CREATE TABLE IF NOT EXISTS dpro_items (
    id BIGSERIAL PRIMARY KEY,
    dpro_item_id TEXT UNIQUE NOT NULL,           -- DPro API item id (自然キー)
    product_id TEXT,                              -- DPro product ID
    product_name TEXT,                            -- 商材名
    genre_id TEXT,                                -- DPro genre ID
    genre_name TEXT,                              -- ジャンル名
    advertiser_name TEXT,                         -- 広告主名
    app_name TEXT,                                -- 媒体名 (Facebook, TikTok, etc.)
    app_id TEXT,                                  -- 媒体ID
    production_url TEXT,                          -- 動画/画像URL
    thumbnail_url TEXT,                           -- サムネイルURL
    transition_url TEXT,                          -- 遷移先LP URL
    duration_sec INT,                             -- DPro表示の尺(秒)
    media_type TEXT,                              -- video / banner
    video_shape TEXT,                             -- 縦型 / 横型 / 正方形
    ad_sentence TEXT,                             -- 広告見出しテキスト
    ad_all_sentence TEXT,                         -- 広告全文テキスト
    narration TEXT,                               -- ナレーション（DPro提供）
    cost BIGINT,                                  -- 推定出稿額
    cost_difference BIGINT,                       -- 出稿額変化
    play_count BIGINT,                            -- 再生回数
    digg_count BIGINT,                            -- いいね数
    creation_time DATE,                           -- 広告作成日
    streaming_period_days INT,                    -- 配信期間(日)
    processing_status TEXT DEFAULT 'pending',     -- pending/processing/completed/failed
    metadata JSONB DEFAULT '{}',                  -- その他DProフィールド
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpro_items_product ON dpro_items(product_id);
CREATE INDEX IF NOT EXISTS idx_dpro_items_genre ON dpro_items(genre_id);
CREATE INDEX IF NOT EXISTS idx_dpro_items_advertiser ON dpro_items(advertiser_name);
CREATE INDEX IF NOT EXISTS idx_dpro_items_status ON dpro_items(processing_status);

COMMENT ON TABLE dpro_items IS '競合CR(動画分析PRO)マスタ。DPro item_id が自然キー';

-- ============================================
-- 2. dpro_videos — 動画分析結果
-- ============================================
CREATE TABLE IF NOT EXISTS dpro_videos (
    id BIGSERIAL PRIMARY KEY,
    dpro_item_id BIGINT NOT NULL REFERENCES dpro_items(id) ON DELETE CASCADE,
    duration_ms INT,                             -- 実測尺(ms, ffprobe)
    fps FLOAT,
    width INT,
    height INT,
    scene_count INT DEFAULT 0,
    transcription TEXT,                          -- 音声書き起こし (Gemini Flash)
    telop_full_text TEXT,                        -- テロップ全文結合
    video_embedding halfvec(3072),               -- 動画全体ベクトル
    text_embedding halfvec(3072),                -- テキスト全体ベクトル
    analysis_model TEXT,
    processing_status TEXT DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dpro_item_id)
);

CREATE INDEX IF NOT EXISTS idx_dpro_videos_item ON dpro_videos(dpro_item_id);
CREATE INDEX IF NOT EXISTS idx_dpro_videos_status ON dpro_videos(processing_status);

COMMENT ON TABLE dpro_videos IS '競合CR動画分析結果。1 dpro_item = 1 dpro_video';

-- ============================================
-- 3. dpro_scenes — シーン単位
-- ============================================
CREATE TABLE IF NOT EXISTS dpro_scenes (
    id BIGSERIAL PRIMARY KEY,
    video_id BIGINT NOT NULL REFERENCES dpro_videos(id) ON DELETE CASCADE,
    scene_index INT NOT NULL,
    start_ms INT NOT NULL,
    end_ms INT NOT NULL,
    duration_ms INT,
    telop_text TEXT,                              -- Cloud Vision OCR
    scene_description TEXT,
    scene_embedding halfvec(3072),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, scene_index)
);

CREATE INDEX IF NOT EXISTS idx_dpro_scenes_video ON dpro_scenes(video_id);

COMMENT ON TABLE dpro_scenes IS '競合CRシーン単位データ';

-- ============================================
-- 4. HNSW インデックス
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dpro_videos_video_emb_hnsw ON dpro_videos
    USING hnsw (video_embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_dpro_videos_text_emb_hnsw ON dpro_videos
    USING hnsw (text_embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_dpro_scenes_emb_hnsw ON dpro_scenes
    USING hnsw (scene_embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- 5. 横断検索関数: 自社CR + 競合CR を同時検索
-- ============================================
CREATE OR REPLACE FUNCTION search_cross_similar_by_video(
    query_embedding halfvec(3072),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    source TEXT,
    item_id BIGINT,
    item_name TEXT,
    item_url TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    (
        SELECT
            'own'::TEXT AS source,
            v.creative_id AS item_id,
            c.creative_name AS item_name,
            c.cr_url AS item_url,
            (1 - (v.video_embedding <=> query_embedding))::FLOAT AS similarity
        FROM cr_videos v
        JOIN creatives c ON v.creative_id = c.id
        WHERE v.video_embedding IS NOT NULL
          AND 1 - (v.video_embedding <=> query_embedding) > match_threshold
    )
    UNION ALL
    (
        SELECT
            'competitor'::TEXT AS source,
            d.id AS item_id,
            d.product_name AS item_name,
            d.production_url AS item_url,
            (1 - (dv.video_embedding <=> query_embedding))::FLOAT AS similarity
        FROM dpro_videos dv
        JOIN dpro_items d ON dv.dpro_item_id = d.id
        WHERE dv.video_embedding IS NOT NULL
          AND 1 - (dv.video_embedding <=> query_embedding) > match_threshold
    )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VIEW: 競合CR embedding状況
-- ============================================
CREATE OR REPLACE VIEW v_dpro_embedding_status AS
SELECT
    d.id,
    d.dpro_item_id,
    d.product_name,
    d.genre_name,
    d.app_name,
    d.processing_status AS item_status,
    dv.id AS video_id,
    dv.duration_ms,
    dv.scene_count,
    dv.processing_status AS video_status,
    dv.video_embedding IS NOT NULL AS has_video_embedding,
    dv.text_embedding IS NOT NULL AS has_text_embedding,
    dv.error_message
FROM dpro_items d
LEFT JOIN dpro_videos dv ON dv.dpro_item_id = d.id;

COMMENT ON VIEW v_dpro_embedding_status IS '競合CR embedding処理状況';

-- ============================================
-- 7. updated_at トリガー
-- ============================================
CREATE OR REPLACE TRIGGER set_dpro_items_updated_at
    BEFORE UPDATE ON dpro_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_dpro_videos_updated_at
    BEFORE UPDATE ON dpro_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
