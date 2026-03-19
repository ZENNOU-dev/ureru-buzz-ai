/** Notion DBプロパティ型定義 */

export interface NotionTenantRecord {
  tenantId: string;
  name: string;
  apName?: string;
  mpName?: string;
  cpName?: string;
  cdName?: string;
  kpiCpa?: number;
  kpiCvPerMonth?: number;
  monthlyBudget?: number;
  platforms?: string[];
}

export interface NotionAppealRecord {
  tenantId: string;
  appealNo: number;
  appealName: string;
  who: string;
  what: string;
  why: string;
  usp?: string;
  differentiator?: string;
  status: string;
}

export interface NotionPlanRecord {
  tenantId: string;
  appealId: string;
  planName: string;
  interestType: string;
  structureType: string;
  fvText?: string;
  fvVisual?: string;
  composition?: string;
  hypothesisWatch?: string;
  hypothesisRelevance?: string;
  hypothesisBelieve?: string;
  hypothesisAction?: string;
  status: string;
}

export interface NotionScriptRecord {
  tenantId: string;
  planId: string;
  scriptText: string;
  hookVariation: number;
  hookText: string;
  interestType: string;
  charCount: number;
  annotations?: string[];
  status: string;
}

export interface NotionEditBriefRecord {
  tenantId: string;
  scriptId: string;
  cuts: NotionCut[];
  bgm?: NotionBgm;
  totalCharCount: number;
  status: string;
}

export interface NotionCut {
  section: string;
  scriptText: string;
  materialId?: string;
  materialUrl?: string;
  materialName?: string;
  isAiGenerated?: boolean;
  subtitleText?: string;
  subtitleStyle?: string;
  effects?: string[];
  soundEffects?: string[];
  durationSeconds?: number;
}

export interface NotionBgm {
  name: string;
  url: string;
  volume?: number;
}

export interface NotionMaterialRecord {
  tenantId: string;
  name: string;
  format: "video" | "image" | "illustration" | "audio";
  genre?: string;
  description?: string;
  cast?: string;
  status: string;
  url: string;
  driveFileId?: string;
  aiGeneratedSource?: string;
}

export interface NotionRegulationRecord {
  tenantId?: string;
  category: string;
  ruleType: string;
  ngExpression: string;
  okAlternative?: string;
  reason?: string;
}

export interface NotionApprovalRecord {
  tenantId: string;
  phase: string;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  comment?: string;
  targetPageUrl?: string;
}
