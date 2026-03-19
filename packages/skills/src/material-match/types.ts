import type { ScriptSection, StructureType } from "@ureru-buzz-ai/core";

export interface MaterialMatchInput {
  sectionText: string;
  section: ScriptSection;
  tenantId: string;
  structureType: StructureType;
  concept: string;
  targetAudience: string;
  topK?: number;
}

export interface MaterialMatchResult {
  existingCandidates: MaterialCandidate[];
  selected: MaterialCandidate | null;
  needsMaterial: boolean;
  aiSuggestion?: AiMaterialSuggestion;
}

export interface MaterialCandidate {
  materialId: string;
  materialName?: string;
  url: string;
  score: number;
  reason: string;
  isAiGenerated: boolean;
  source?: string;
}

export interface AiMaterialSuggestion {
  type: "image_only" | "image_to_video";
  imagePrompt: string;
  motionPrompt?: string;
  estimatedCost: string;
  reason: string;
}
