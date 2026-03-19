CREATE TABLE regulation_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    category TEXT NOT NULL CHECK (category IN ('word', 'concept')),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('yakujiho', 'keihinhou', 'platform', 'client_specific')),
    ng_expression TEXT NOT NULL,
    ok_alternative TEXT,
    reason TEXT,
    embedding vector(3072),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_regulation_knowledge_tenant ON regulation_knowledge (tenant_id);
CREATE INDEX idx_regulation_knowledge_type ON regulation_knowledge (rule_type);
CREATE INDEX idx_regulation_knowledge_embedding ON regulation_knowledge
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE regulation_knowledge IS 'レギュレーションナレッジ。tenant_id=NULLは薬機法等の共通ルール';
