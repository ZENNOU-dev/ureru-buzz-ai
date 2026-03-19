import type { LLMSkill } from "../llm/client.js";
import type { ScriptSection, StructureType } from "@ureru-buzz-ai/core";

/**
 * Generate motion/camera prompt for Kling AI Image-to-Video
 * Output is English, 1-2 sentences describing movement
 */
export async function generateMotionPrompt(
  llm: LLMSkill,
  section: ScriptSection,
  scriptText: string,
  structureType: StructureType,
): Promise<string> {
  return llm.generate({
    systemPrompt: `You are a video motion director for short-form ads.
Generate a 1-2 sentence English motion instruction for Image-to-Video conversion.

Rules:
- Keep it concise (max 2 sentences)
- Include camera movement (slow zoom in, pan, dolly, etc.)
- Describe subject movement if applicable
- Optimized for 5-10 second clips
- Style should match the ad structure type: ${structureType}
- Focus on creating visual hook and engagement`,
    userPrompt: `Script section: ${section}
Script text: "${scriptText}"
Structure type: ${structureType}

Generate a motion instruction for this scene.`,
    temperature: 0.7,
    maxTokens: 150,
  });
}
