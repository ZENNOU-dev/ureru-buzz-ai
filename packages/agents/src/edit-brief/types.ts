import type { ScriptSection } from "@ureru-buzz-ai/core";

export interface EditBriefAgentInput {
  scriptId: string;
}

export interface EditBriefAgentOutput {
  editBriefPageId: string;
  totalCuts: number;
  materialsNeedingAttention: number;
}

export interface ScriptSectionData {
  section: ScriptSection;
  text: string;
}
