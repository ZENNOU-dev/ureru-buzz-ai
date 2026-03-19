CREATE TABLE material_text_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    material_id TEXT NOT NULL,
    description TEXT NOT NULL,
    embedding vector(3072) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_text_embeddings_tenant ON material_text_embeddings (tenant_id);
CREATE INDEX idx_material_text_embeddings_material ON material_text_embeddings (material_id);
CREATE INDEX idx_material_text_embeddings_vector ON material_text_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE material_text_embeddings IS '素材のテキストエンベディング（AI生成の説明文）';
