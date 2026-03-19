CREATE TABLE operation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'tiktok', 'youtube', 'line', 'x')),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('stop', 'continue', 'expand', 'shrink')),
    condition JSONB NOT NULL,
    action JSONB NOT NULL DEFAULT '{}',
    priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operation_rules_tenant ON operation_rules (tenant_id);
CREATE INDEX idx_operation_rules_enabled ON operation_rules (tenant_id, enabled) WHERE enabled = true;

COMMENT ON TABLE operation_rules IS '運用自動化ルール（5分間隔判断用）';
