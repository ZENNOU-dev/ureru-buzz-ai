import { describe, it, expect, vi, beforeEach } from "vitest";
import { NanoBanana2Skill } from "../../nanobanana2/skill.js";
import { generateMaterialPrompt } from "../../nanobanana2/prompt-generator.js";
import type { LLMSkill } from "../../llm/client.js";

describe("NanoBanana2Skill", () => {
  describe("generateImage", () => {
    it("throws not-implemented in MVP", async () => {
      const skill = new NanoBanana2Skill();
      await expect(
        skill.generateImage("test prompt", "/tmp/test.png"),
      ).rejects.toThrow("not yet implemented");
    });
  });

  describe("editImage", () => {
    it("throws not-implemented in MVP", async () => {
      const skill = new NanoBanana2Skill();
      await expect(
        skill.editImage("/tmp/source.png", "edit prompt", "/tmp/output.png"),
      ).rejects.toThrow("not yet implemented");
    });
  });
});

describe("generateMaterialPrompt", () => {
  it("calls LLM with correct parameters", async () => {
    const mockLlm = {
      generate: vi.fn().mockResolvedValueOnce(
        "A Japanese woman in her 40s looking worried at hair in mirror, vertical 9:16 format",
      ),
    } as unknown as LLMSkill;

    const result = await generateMaterialPrompt(mockLlm, {
      section: "hook",
      scriptText: "毎朝、枕についた大量の抜け毛を見て...",
      structureType: "ugc",
      concept: "育毛剤",
      targetAudience: "40代女性",
    });

    expect(result).toContain("mirror");
    expect(mockLlm.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("9:16"),
        userPrompt: expect.stringContaining("hook"),
      }),
    );
  });
});
