/** ワークフローフェーズ */
export const PHASES = [
  "setup",
  "research",
  "appeal",
  "planning",
  "script",
  "edit_brief",
  "video",
  "submission",
  "operation",
  "reporting",
] as const;
export type Phase = (typeof PHASES)[number];

/** フェーズのステータス */
export const PHASE_STATUSES = [
  "not_started",
  "running",
  "awaiting_approval",
  "approved",
  "rejected",
  "completed",
  "error",
] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

/** 興味の型（フック） */
export const INTEREST_TYPES = [
  "product",        // 商品興味
  "episode",        // エピソード興味
  "method",         // 手法興味
  "fear",           // 恐怖興味
  "future",         // 未来興味
  "loss",           // 損失興味
  "paradigm_shift", // 常識破壊
  "target",         // ターゲット指定
] as const;
export type InterestType = (typeof INTEREST_TYPES)[number];

/** 構成の型（動画全体のフォーマット） */
export const STRUCTURE_TYPES = [
  "ugc",
  "anime",
  "corporate",
  "narration",
  "store_experience",
  "drama",
  "banner_video",
  "illustration",
  "influencer",
  "trivia",
  "ai",
] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

/** 台本セクション */
export const SCRIPT_SECTIONS = [
  "hook",
  "empathy",
  "concept",
  "product",
  "benefit",
  "offer",
  "cta",
] as const;
export type ScriptSection = (typeof SCRIPT_SECTIONS)[number];

/** 素材ステータス */
export const MATERIAL_STATUSES = [
  "available",         // 利用可
  "client_provided",   // クライアント提供（当該テナントのみ）
  "prohibited",        // 利用禁止
  "ai_generated",      // AI生成（未レビュー）
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

/** 広告プラットフォーム */
export const AD_PLATFORMS = [
  "meta",
  "tiktok",
  "youtube",
  "line",
  "x",
] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

/** 運用判断タイプ */
export const OPERATION_ACTIONS = [
  "stop",
  "continue",
  "expand",
  "shrink",
] as const;
export type OperationAction = (typeof OPERATION_ACTIONS)[number];

/** 承認ポーリング間隔 (ms) */
export const APPROVAL_POLLING_INTERVAL = 30_000;

/** Notion APIレート制限 (req/sec) */
export const NOTION_RATE_LIMIT = 3;

/** 運用チェック間隔 (ms) */
export const OPERATION_CHECK_INTERVAL = 5 * 60 * 1000;

/** 素材マッチング閾値 */
export const MATERIAL_MATCH_THRESHOLD = 0.6;

/** エンベディング次元数 */
// VMS uses Gemini text-embedding-004 (768 dims)
// New embeddings use OpenAI text-embedding-3-large (3072 dims)
export const VMS_EMBEDDING_DIMENSIONS = 768;
export const EMBEDDING_DIMENSIONS = 3072;
