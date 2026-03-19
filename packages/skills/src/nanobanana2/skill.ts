import { logger } from "@ureru-buzz-ai/core";
import type { GeneratedMaterial } from "./types.js";

/**
 * NanoBanana2 image generation/editing skill
 *
 * MVP: Defines the interface. Actual execution depends on context:
 * - In Claude MCP session: uses mcp__nanobanana__generate_image
 * - In standalone backend: uses Gemini API directly (future)
 *
 * For Sprint 1, this is primarily used for prompt generation.
 * Actual image generation is triggered only after CD approval.
 */
export class NanoBanana2Skill {
  /**
   * Generate a new image from a text prompt
   */
  async generateImage(
    prompt: string,
    outputPath: string,
  ): Promise<GeneratedMaterial> {
    logger.info("nanobanana2-generate", { prompt: prompt.slice(0, 100), outputPath });

    // MVP: This will be called post-CD-approval via orchestrator
    // For now, throw if called directly (Sprint 1 only generates proposals)
    throw new Error(
      "NanoBanana2Skill.generateImage: Direct execution not yet implemented. " +
      "Use MaterialMatchSkill.buildAiSuggestion() for proposals.",
    );
  }

  /**
   * Edit an existing image based on a prompt
   */
  async editImage(
    imagePath: string,
    editPrompt: string,
    outputPath: string,
  ): Promise<GeneratedMaterial> {
    logger.info("nanobanana2-edit", { imagePath, editPrompt: editPrompt.slice(0, 100), outputPath });

    throw new Error(
      "NanoBanana2Skill.editImage: Direct execution not yet implemented. " +
      "Use MaterialMatchSkill.buildAiSuggestion() for proposals.",
    );
  }
}
