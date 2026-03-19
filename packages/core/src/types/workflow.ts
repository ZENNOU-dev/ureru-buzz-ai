import type { Phase, PhaseStatus } from "../config/constants.js";

export interface WorkflowState {
  tenantId: string;
  projectId: string;
  currentPhase: Phase;
  phases: Record<Phase, PhaseState>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PhaseState {
  status: PhaseStatus;
  startedAt?: Date;
  completedAt?: Date;
  approvedBy?: string;
  rejectionComment?: string;
  notionPageId?: string;
}

export interface ApprovalConfig {
  phase: Phase;
  approvers: string[];
  required: boolean;
  autoApproveAfterHours?: number;
}

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  phase: Phase;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  comment?: string;
  notionPageId: string;
  createdAt: Date;
  resolvedAt?: Date;
}
