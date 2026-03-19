-- Row Level Security を全テーブルに適用

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulation_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_text_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_logs ENABLE ROW LEVEL SECURITY;

-- Service Role はフルアクセス（バックエンドからの操作用）
-- Anon Key はテナント分離されたアクセスのみ

-- knowledge_base: tenant_id一致 OR tenant_id IS NULL（共通ナレッジ）
CREATE POLICY "tenant_isolation" ON knowledge_base
    FOR ALL
    USING (
        tenant_id = (current_setting('app.tenant_id', true))::uuid
        OR tenant_id IS NULL
    );

-- regulation_knowledge: 同上
CREATE POLICY "tenant_isolation" ON regulation_knowledge
    FOR ALL
    USING (
        tenant_id = (current_setting('app.tenant_id', true))::uuid
        OR tenant_id IS NULL
    );

-- その他テーブル: tenant_id完全一致
CREATE POLICY "tenant_isolation" ON material_embeddings
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY "tenant_isolation" ON material_text_embeddings
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY "tenant_isolation" ON video_embeddings
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY "tenant_isolation" ON operation_rules
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY "tenant_isolation" ON operation_logs
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

CREATE POLICY "tenant_isolation" ON approval_logs
    FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- RPC関数: ナレッジベクトル検索
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding vector(3072),
    match_count int DEFAULT 10,
    filter_tenant_id uuid DEFAULT NULL,
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    tenant_id uuid,
    category text,
    content text,
    performance_score decimal,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.tenant_id,
        kb.category,
        kb.content,
        kb.performance_score,
        kb.metadata,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE
        (filter_tenant_id IS NULL OR kb.tenant_id = filter_tenant_id OR kb.tenant_id IS NULL)
        AND (filter_category IS NULL OR kb.category = filter_category)
        AND kb.embedding IS NOT NULL
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- RPC関数: 素材ベクトル検索
CREATE OR REPLACE FUNCTION match_materials(
    query_embedding vector(3072),
    match_count int DEFAULT 10,
    filter_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    material_id text,
    description text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mte.id,
        mte.material_id,
        mte.description,
        1 - (mte.embedding <=> query_embedding) AS similarity
    FROM material_text_embeddings mte
    WHERE
        (filter_tenant_id IS NULL OR mte.tenant_id = filter_tenant_id)
        AND mte.embedding IS NOT NULL
    ORDER BY mte.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
