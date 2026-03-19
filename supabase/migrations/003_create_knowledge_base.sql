CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    category TEXT NOT NULL CHECK (category IN ('appeal', 'structure_type', 'interest_type', 'hook', 'composition', 'cut', 'meeting')),
    content TEXT NOT NULL,
    performance_score DECIMAL,
    embedding vector(3072),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_base_tenant ON knowledge_base (tenant_id);
CREATE INDEX idx_knowledge_base_category ON knowledge_base (category);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE knowledge_base IS 'ナレッジベース。tenant_id=NULLは全テナント共通';
