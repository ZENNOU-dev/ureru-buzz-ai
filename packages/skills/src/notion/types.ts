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

// Property name constants for EditBrief Master DB (全体情報)
export const EDIT_BRIEF_MASTER_DB_PROPS = {
  title: "編集概要名",
  tenantId: "テナントID",
  scriptId: "台本ID",
  totalCharCount: "全体文字数",
  speaker: "話者設定",
  voiceFile: "音声ファイル",
  bgmName: "BGM名",
  bgmUrl: "BGM_URL",
  reference: "参考/備考",
  status: "ステータス",
} as const;

// Property name constants for EditBrief Cut DB (カット単位)
export const EDIT_BRIEF_CUT_DB_PROPS = {
  title: "カット名",
  editBriefId: "編集概要ID",
  tenantId: "テナントID",
  cutNumber: "カット番号",
  charCount: "文字数",
  text: "テキスト",
  subtitle: "テロップ",
  materialName1: "素材名①",
  materialUrl1: "素材①URL",
  materialName2: "素材名②",
  materialUrl2: "素材②URL",
  materialScore: "素材スコア",
  aiSuggestion: "AI生成提案",
  aiGenerated: "AI生成済み",
  annotation: "注釈",
  regulationCheck: "レギュチェック欄",
  motionEffect: "モーションエフェクト",
  soundEffect: "効果音",
  otherDirections: "その他編集指示",
  revisionRequest: "修正版依頼",
  revision2: "修正②",
  revision3: "修正③",
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
