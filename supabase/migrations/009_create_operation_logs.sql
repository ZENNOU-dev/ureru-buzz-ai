CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    platform TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    rule_type TEXT NOT NULL,
    condition_snapshot JSONB NOT NULL DEFAULT '{}',
    performance_snapshot JSONB NOT NULL DEFAULT '{}',
    action_taken TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operation_logs_tenant ON operation_logs (tenant_id);
CREATE INDEX idx_operation_logs_created ON operation_logs (created_at DESC);

COMMENT ON TABLE operation_logs IS '運用自動化の実行ログ';
