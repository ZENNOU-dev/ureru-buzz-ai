CREATE TABLE approval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    phase TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approver TEXT,
    comment TEXT,
    notion_page_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_logs_tenant ON approval_logs (tenant_id);
CREATE INDEX idx_approval_logs_pending ON approval_logs (status) WHERE status = 'pending';

COMMENT ON TABLE approval_logs IS '承認フローログ';
