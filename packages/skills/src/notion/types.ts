/**
 * Notion DB ID configuration - populated per tenant
 */
export interface NotionDbIds {
  tenant: string;
  research: string;
  appeal: string;
  plan: string;
  script: string;
  editBrief: string;
  material: string;
  video: string;
  submission: string;
  regulation: string;
  approval: string;
}

// Property name constants for Script DB (Japanese)
export const SCRIPT_DB_PROPS = {
  tenantId: "テナントID",
  title: "台本名",
  planId: "企画ID",
  scriptText: "台本テキスト",
  hookVariation: "フックバリエーション",
  hookText: "フックテキスト",
  interestType: "興味の型",
  charCount: "文字数",
  annotations: "注釈",
  status: "ステータス",
} as const;

// Property name constants for EditBrief DB
export const EDIT_BRIEF_DB_PROPS = {
  tenantId: "テナントID",
  title: "編集概要名",
  scriptId: "台本ID",
  cuts: "カット情報",
  bgm: "BGM",
  totalCharCount: "総文字数",
  status: "ステータス",
} as const;

// Property name constants for Material DB
export const MATERIAL_DB_PROPS = {
  tenantId: "テナントID",
  name: "素材名",
  format: "フォーマット",
  genre: "ジャンル",
  description: "説明",
  cast: "キャスト",
  status: "ステータス",
  url: "URL",
  driveFileId: "DriveファイルID",
  aiGeneratedSource: "AI生成元",
} as const;
