-- Migration 018: CR動画ベクトル化テーブル
-- ============================================
-- cr_videos: 動画エンティティ (1:1 with creatives)
-- cr_scenes: シーンエンティティ (素材+テロップ)
-- halfvec(3072): Gemini Embedding 2 デフォルト次元
-- ============================================

-- pgvector extension (already enabled, safe to re-run)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. cr_videos — 動画DB
-- ============================================
CREATE TABLE IF NOT EXISTS cr_videos (
    id BIGSERIAL PRIMARY KEY,
    creative_id BIGINT NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
    duration_ms INT,                           -- 動画尺(ms)
    fps FLOAT,                                 -- フレームレート
    width INT,                                 -- 解像度 幅
    height INT,                                -- 解像度 高さ
    scene_count INT DEFAULT 0,                 -- 検出シーン数
    transcription TEXT,                        -- 音声書き起こし全文
    telop_full_text TEXT,                      -- テロップ全文結合
    video_embedding halfvec(3072),             -- 動画全体ベクトル (Gemini Embedding 2)
    text_embedding halfvec(3072),              -- テキスト全体ベクトル
    analysis_model TEXT,                       -- 分析に使ったモデル名
    processing_status TEXT DEFAULT 'pending',  -- pending/processing/completed/failed/skipped
    error_message TEXT,                        -- 失敗時のエラー詳細
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(creative_id)
);

CREATE INDEX idx_cr_videos_creative ON cr_videos(creative_id);
CREATE INDEX idx_cr_videos_status ON cr_videos(processing_status);

COMMENT ON TABLE cr_videos IS '動画エンティティ。1CR=1動画。メタ情報+書き起こし+動画全体/テキスト全体ベクトル';
COMMENT ON COLUMN cr_videos.video_embedding IS 'Gemini Embedding 2 動画全体ベクトル (3072d halfvec)';
COMMENT ON COLUMN cr_videos.text_embedding IS 'Gemini Embedding 2 テキスト全体ベクトル (3072d halfvec)';

-- ============================================
-- 2. cr_scenes — シーンDB (素材+テキスト)
-- ============================================
CREATE TABLE IF NOT EXISTS cr_scenes (
    id BIGSERIAL PRIMARY KEY,
    video_id BIGINT NOT NULL REFERENCES cr_videos(id) ON DELETE CASCADE,
    scene_index INT NOT NULL,                  -- 0-based順序
    start_ms INT NOT NULL,                     -- 開始時刻(ms)
    end_ms INT NOT NULL,                       -- 終了時刻(ms)
    duration_ms INT,                           -- シーン尺(ms)
    telop_text TEXT,                           -- このシーンのテロップ (Cloud Vision OCR)
    scene_description TEXT,                    -- シーン内容説明
    scene_embedding halfvec(3072),             -- シーンベクトル (代表フレーム画像embed)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, scene_index)
);

CREATE INDEX idx_cr_scenes_video ON cr_scenes(video_id);

COMMENT ON TABLE cr_scenes IS 'シーンエンティティ。素材(映像)+テキスト(テロップ)の組み合わせ';
COMMENT ON COLUMN cr_scenes.scene_embedding IS 'Gemini Embedding 2 シーン代表フレーム画像ベクトル (3072d halfvec)';

-- ============================================
-- 3. HNSW インデックス (halfvec cosine)
-- ============================================
CREATE INDEX idx_cr_videos_video_emb_hnsw ON cr_videos
    USING hnsw (video_embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_cr_videos_text_emb_hnsw ON cr_videos
    USING hnsw (text_embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_cr_scenes_emb_hnsw ON cr_scenes
    USING hnsw (scene_embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- 4. creatives テーブル変更
-- ============================================
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE creatives DROP COLUMN IF EXISTS embedding;

-- 旧検索関数を削除
DROP FUNCTION IF EXISTS search_similar_creatives(vector, double precision, integer);

-- ============================================
-- 5. 検索関数
-- ============================================

-- 動画全体で類似CR検索
CREATE OR REPLACE FUNCTION search_similar_cr_by_video(
    query_embedding halfvec(3072),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    creative_id BIGINT,
    creative_name TEXT,
    cr_url TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.creative_id,
        c.creative_name,
        c.cr_url,
        (1 - (v.video_embedding <=> query_embedding))::FLOAT AS similarity
    FROM cr_videos v
    JOIN creatives c ON v.creative_id = c.id
    WHERE v.video_embedding IS NOT NULL
      AND 1 - (v.video_embedding <=> query_embedding) > match_threshold
    ORDER BY v.video_embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- テキストで類似CR検索
CREATE OR REPLACE FUNCTION search_similar_cr_by_text(
    query_embedding halfvec(3072),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    creative_id BIGINT,
    creative_name TEXT,
    cr_url TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.creative_id,
        c.creative_name,
        c.cr_url,
        (1 - (v.text_embedding <=> query_embedding))::FLOAT AS similarity
    FROM cr_videos v
    JOIN creatives c ON v.creative_id = c.id
    WHERE v.text_embedding IS NOT NULL
      AND 1 - (v.text_embedding <=> query_embedding) > match_threshold
    ORDER BY v.text_embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- シーン素材で類似シーン検索
CREATE OR REPLACE FUNCTION search_similar_scenes(
    query_embedding halfvec(3072),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    scene_id BIGINT,
    creative_id BIGINT,
    creative_name TEXT,
    scene_index INT,
    start_ms INT,
    end_ms INT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id AS scene_id,
        v.creative_id,
        c.creative_name,
        s.scene_index,
        s.start_ms,
        s.end_ms,
        (1 - (s.scene_embedding <=> query_embedding))::FLOAT AS similarity
    FROM cr_scenes s
    JOIN cr_videos v ON s.video_id = v.id
    JOIN creatives c ON v.creative_id = c.id
    WHERE s.scene_embedding IS NOT NULL
      AND 1 - (s.scene_embedding <=> query_embedding) > match_threshold
    ORDER BY s.scene_embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VIEW: エージェント用
-- ============================================
CREATE OR REPLACE VIEW v_cr_embedding_status AS
SELECT
    c.id AS creative_id,
    c.creative_name,
    c.cr_url,
    c.processing_status,
    p.name AS project_name,
    v.id AS video_id,
    v.duration_ms,
    v.scene_count,
    v.processing_status AS video_status,
    v.video_embedding IS NOT NULL AS has_video_embedding,
    v.text_embedding IS NOT NULL AS has_text_embedding,
    v.error_message
FROM creatives c
LEFT JOIN projects p ON c.project_id = p.id
LEFT JOIN cr_videos v ON v.creative_id = c.id;

COMMENT ON VIEW v_cr_embedding_status IS 'エージェント用: CR embedding処理状況。起点: creative_id or project_name';

-- ============================================
-- 7. updated_at トリガー
-- ============================================
CREATE OR REPLACE TRIGGER set_cr_videos_updated_at
    BEFORE UPDATE ON cr_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
