import type { ScriptSection, StructureType } from "@ureru-buzz-ai/core";
import type { LLMSkill } from "../llm/client.js";
import { generateMaterialPrompt } from "../nanobanana2/prompt-generator.js";
import { generateMotionPrompt } from "../kling/motion-prompt.js";
import type { AiMaterialSuggestion, MaterialMatchInput } from "./types.js";

// Structure types that don't need video (static images suffice)
const STATIC_STRUCTURE_TYPES = new Set(["anime", "illustration", "banner_video"]);
// Sections where video is more effective than static image
const VIDEO_SECTIONS = new Set<ScriptSection>(["hook", "empathy", "product"]);

export class AiSuggestionBuilder {
  constructor(private llm: LLMSkill) {}

  /**
   * Build an AI material generation suggestion (proposal only, no execution)
   */
  async buildSuggestion(input: MaterialMatchInput): Promise<AiMaterialSuggestion> {
    // Generate image prompt
    const imagePrompt = await generateMaterialPrompt(this.llm, {
      section: input.section,
      scriptText: input.sectionText,
      structureType: input.structureType,
      concept: input.concept,
      targetAudience: input.targetAudience,
    });

    const needsVideo = this.shouldGenerateVideo(input.section, input.structureType);

    let motionPrompt: string | undefined;
    if (needsVideo) {
      motionPrompt = await generateMotionPrompt(
        this.llm,
        input.section,
        input.sectionText,
        input.structureType,
      );
    }

    return {
      type: needsVideo ? "image_to_video" : "image_only",
      imagePrompt,
      motionPrompt,
      estimatedCost: needsVideo ? "$0.24" : "$0.04",
      reason: `台本「${input.sectionText.substring(0, 30)}...」に適合する既存素材が不足`,
    };
  }

  /**
   * Determine if video generation is needed based on section and structure type
   */
  shouldGenerateVideo(section: ScriptSection, structureType: StructureType): boolean {
    // Static structure types don't need video
    if (STATIC_STRUCTURE_TYPES.has(structureType)) return false;
    // Video is effective for hook, empathy, and product sections
    return VIDEO_SECTIONS.has(section);
  }
}
