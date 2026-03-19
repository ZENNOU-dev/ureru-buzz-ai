import { describe, it, expect, vi } from "vitest";
import { AiSuggestionBuilder } from "../../material-match/ai-suggestion.js";
import type { LLMSkill } from "../../llm/client.js";

describe("AiSuggestionBuilder", () => {
  const mockLlm = {
    generate: vi.fn().mockResolvedValue("test prompt output"),
  } as unknown as LLMSkill;

  const builder = new AiSuggestionBuilder(mockLlm);

  describe("shouldGenerateVideo", () => {
    it("returns false for anime structure type", () => {
      expect(builder.shouldGenerateVideo("hook", "anime")).toBe(false);
    });

    it("returns false for illustration structure type", () => {
      expect(builder.shouldGenerateVideo("hook", "illustration")).toBe(false);
    });

    it("returns false for banner_video structure type", () => {
      expect(builder.shouldGenerateVideo("hook", "banner_video")).toBe(false);
    });

    it("returns true for hook section with ugc structure", () => {
      expect(builder.shouldGenerateVideo("hook", "ugc")).toBe(true);
    });

    it("returns true for empathy section with drama structure", () => {
      expect(builder.shouldGenerateVideo("empathy", "drama")).toBe(true);
    });

    it("returns false for cta section with ugc structure", () => {
      expect(builder.shouldGenerateVideo("cta", "ugc")).toBe(false);
    });
  });

  describe("buildSuggestion", () => {
    it("builds image_only suggestion for static types", async () => {
      const result = await builder.buildSuggestion({
        sectionText: "テスト台本",
        section: "hook",
        tenantId: "11111111-1111-1111-1111-111111111111",
        structureType: "anime",
        concept: "テスト",
        targetAudience: "20代",
      });

      expect(result.type).toBe("image_only");
      expect(result.motionPrompt).toBeUndefined();
      expect(result.estimatedCost).toBe("$0.04");
    });

    it("builds image_to_video suggestion for dynamic types", async () => {
      const result = await builder.buildSuggestion({
        sectionText: "テスト台本",
        section: "hook",
        tenantId: "11111111-1111-1111-1111-111111111111",
        structureType: "ugc",
        concept: "テスト",
        targetAudience: "30代",
      });

      expect(result.type).toBe("image_to_video");
      expect(result.motionPrompt).toBeDefined();
      expect(result.estimatedCost).toBe("$0.24");
    });
  });
});
