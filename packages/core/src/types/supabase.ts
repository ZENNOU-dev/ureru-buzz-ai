/** ureru-buzz-ai 専用 Supabase テーブル型定義 */

export interface Tenant {
  id: string;
  name: string;
  ad_orch_client_id?: string;
  vms_project_name?: string;
  notion_workspace_id?: string;
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  tenant_id?: string;
  category: "appeal" | "structure_type" | "interest_type" | "hook" | "composition" | "cut";
  content: string;
  performance_score?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RegulationKnowledge {
  id: string;
  tenant_id?: string;
  category: "word" | "concept";
  rule_type: "yakujiho" | "keihinhou" | "platform" | "client_specific";
  ng_expression: string;
  ok_alternative?: string;
  reason?: string;
  embedding?: number[];
  created_at: string;
}

export interface MaterialEmbedding {
  id: string;
  tenant_id: string;
  material_id: string;
  frame_timestamp: number;
  embedding: number[];
  frame_url?: string;
  created_at: string;
}

export interface MaterialTextEmbedding {
  id: string;
  tenant_id: string;
  material_id: string;
  description: string;
  embedding: number[];
  created_at: string;
}

export interface VideoEmbedding {
  id: string;
  tenant_id: string;
  video_id: string;
  frame_timestamp: number;
  section?: string;
  embedding: number[];
  created_at: string;
}

export interface OperationRule {
  id: string;
  tenant_id: string;
  platform: string;
  rule_type: "stop" | "continue" | "expand" | "shrink";
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface OperationLog {
  id: string;
  tenant_id: string;
  platform: string;
  ad_id: string;
  ad_name: string;
  rule_type: string;
  condition_snapshot: Record<string, unknown>;
  performance_snapshot: Record<string, unknown>;
  action_taken: string;
  created_at: string;
}

export interface ApprovalLog {
  id: string;
  tenant_id: string;
  phase: string;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  comment?: string;
  notion_page_id?: string;
  created_at: string;
  resolved_at?: string;
}
