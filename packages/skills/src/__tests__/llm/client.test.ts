import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { LLMSkill } from "../../llm/client.js";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mocks: { mockCreate },
  };
});

const { __mocks } = await import("@anthropic-ai/sdk") as any;

describe("LLMSkill", () => {
  let skill: LLMSkill;

  beforeEach(() => {
    vi.clearAllMocks();
    skill = new LLMSkill("test-api-key");
  });

  describe("generate", () => {
    it("returns text from LLM response", async () => {
      __mocks.mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hello world" }],
      });

      const result = await skill.generate({
        systemPrompt: "You are helpful",
        userPrompt: "Say hello",
      });

      expect(result).toBe("Hello world");
    });

    it("throws on empty response", async () => {
      __mocks.mockCreate.mockResolvedValueOnce({
        content: [],
      });

      await expect(
        skill.generate({ systemPrompt: "test", userPrompt: "test" }),
      ).rejects.toThrow("No text content");
    });
  });

  describe("generateStructured", () => {
    const testSchema = z.object({
      name: z.string(),
      score: z.number(),
    });

    it("parses valid JSON response", async () => {
      __mocks.mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: '{"name": "test", "score": 0.8}' }],
      });

      const result = await skill.generateStructured({
        systemPrompt: "test",
        userPrompt: "test",
        schema: testSchema,
      });

      expect(result).toEqual({ name: "test", score: 0.8 });
    });

    it("strips markdown code blocks", async () => {
      __mocks.mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: '```json\n{"name": "test", "score": 0.5}\n```' }],
      });

      const result = await skill.generateStructured({
        systemPrompt: "test",
        userPrompt: "test",
        schema: testSchema,
      });

      expect(result).toEqual({ name: "test", score: 0.5 });
    });

    it("retries on parse failure", async () => {
      __mocks.mockCreate
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "invalid json" }],
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: '{"name": "retry", "score": 0.9}' }],
        });

      const result = await skill.generateStructured({
        systemPrompt: "test",
        userPrompt: "test",
        schema: testSchema,
      });

      expect(result).toEqual({ name: "retry", score: 0.9 });
      expect(__mocks.mockCreate).toHaveBeenCalledTimes(2);
    });
  });
});
