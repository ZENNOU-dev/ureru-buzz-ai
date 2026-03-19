CREATE TABLE video_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    video_id TEXT NOT NULL,
    frame_timestamp DECIMAL NOT NULL,
    section TEXT CHECK (section IN ('hook', 'empathy', 'concept', 'product', 'benefit', 'offer', 'cta')),
    embedding vector(3072) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_embeddings_tenant ON video_embeddings (tenant_id);
CREATE INDEX idx_video_embeddings_video ON video_embeddings (video_id);
CREATE INDEX idx_video_embeddings_vector ON video_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE video_embeddings IS '完成動画のエンベディング（類似動画検索用）';
