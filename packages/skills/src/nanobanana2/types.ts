import type { ScriptSection, StructureType } from "@ureru-buzz-ai/core";

export interface GeneratedMaterial {
  type: "image";
  localPath: string;
  prompt: string;
  generatedAt: Date;
  isEdit?: boolean;
  sourceImagePath?: string;
}

export interface PromptGeneratorInput {
  section: ScriptSection;
  scriptText: string;
  structureType: StructureType;
  concept: string;
  targetAudience: string;
}
