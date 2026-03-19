CREATE TABLE material_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    material_id TEXT NOT NULL,
    frame_timestamp DECIMAL NOT NULL,
    embedding vector(3072) NOT NULL,
    frame_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_embeddings_tenant ON material_embeddings (tenant_id);
CREATE INDEX idx_material_embeddings_material ON material_embeddings (material_id);
CREATE INDEX idx_material_embeddings_vector ON material_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE material_embeddings IS '素材の映像エンベディング（2秒間隔フレーム抽出）';
