// Notion
export { NotionSkill } from "./notion/index.js";
export type { NotionDbIds } from "./notion/types.js";
export { SCRIPT_DB_PROPS, EDIT_BRIEF_DB_PROPS, MATERIAL_DB_PROPS } from "./notion/types.js";
export {
  mapToNotionScriptRecord,
  buildEditBriefProperties,
  mapToNotionMaterialRecord,
} from "./notion/mappers.js";

// LLM
export { LLMSkill } from "./llm/index.js";
export type { LLMGenerateParams, LLMStructuredParams } from "./llm/index.js";

// NanoBanana2
export { NanoBanana2Skill, generateMaterialPrompt } from "./nanobanana2/index.js";
export type { GeneratedMaterial, PromptGeneratorInput } from "./nanobanana2/index.js";

// Kling
export { KlingSkill, generateMotionPrompt } from "./kling/index.js";
export type { KlingVideoRequest, KlingVideoResult, KlingTaskStatus } from "./kling/index.js";

// Material Match
export { MaterialMatchSkill, EmbeddingService, AiSuggestionBuilder, scoreCandidates } from "./material-match/index.js";
export type {
  MaterialMatchInput,
  MaterialMatchResult,
  MaterialCandidate,
  AiMaterialSuggestion,
  SimilarMaterialResult,
} from "./material-match/index.js";
