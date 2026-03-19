CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- 既存DB紐付け（外部参照、FKではない）
    ad_orch_client_id UUID,
    vms_project_name TEXT,
    notion_workspace_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_ad_orch_client ON tenants (ad_orch_client_id) WHERE ad_orch_client_id IS NOT NULL;
CREATE INDEX idx_tenants_vms_project ON tenants (vms_project_name) WHERE vms_project_name IS NOT NULL;

COMMENT ON TABLE tenants IS 'テナント（案件）管理。既存Ad Orchestration / video-material-selectorとはIDで紐付け';
COMMENT ON COLUMN tenants.ad_orch_client_id IS 'Ad Orchestration Supabase の clients.id（外部参照）';
COMMENT ON COLUMN tenants.vms_project_name IS 'video-material-selector の案件名（外部参照）';
