import { describe, it, expect, vi, beforeEach } from "vitest";
import { MaterialMatchSkill } from "../../material-match/matcher.js";
import type { EmbeddingService } from "../../material-match/embedding.js";
import type { AiSuggestionBuilder } from "../../material-match/ai-suggestion.js";

describe("MaterialMatchSkill", () => {
  let skill: MaterialMatchSkill;
  let mockEmbedding: EmbeddingService;
  let mockAiSuggestion: AiSuggestionBuilder;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEmbedding = {
      generateTextEmbedding: vi.fn().mockResolvedValue(new Array(3072).fill(0)),
      searchSimilarMaterials: vi.fn().mockResolvedValue([]),
    } as unknown as EmbeddingService;

    mockAiSuggestion = {
      buildSuggestion: vi.fn().mockResolvedValue({
        type: "image_only",
        imagePrompt: "test prompt",
        estimatedCost: "$0.04",
        reason: "素材不足",
      }),
    } as unknown as AiSuggestionBuilder;

    skill = new MaterialMatchSkill(mockEmbedding, mockAiSuggestion);
  });

  it("returns needsMaterial=false when good match found", async () => {
    (mockEmbedding.searchSimilarMaterials as any).mockResolvedValueOnce([
      {
        id: "m1",
        notionPageId: "n1",
        driveFileId: "d1",
        contentText: "Great matching material",
        score: 0.85,
        metadata: { name: "Material 1" },
      },
    ]);

    const result = await skill.match({
      sectionText: "テスト台本テキスト",
      section: "hook",
      tenantId: "11111111-1111-1111-1111-111111111111",
      structureType: "ugc",
      concept: "テスト商品",
      targetAudience: "30代女性",
    });

    expect(result.needsMaterial).toBe(false);
    expect(result.selected?.score).toBe(0.85);
    expect(result.aiSuggestion).toBeUndefined();
    expect(mockAiSuggestion.buildSuggestion).not.toHaveBeenCalled();
  });

  it("returns needsMaterial=true with AI suggestion when score below threshold", async () => {
    (mockEmbedding.searchSimilarMaterials as any).mockResolvedValueOnce([
      {
        id: "m2",
        notionPageId: "n2",
        driveFileId: "d2",
        contentText: "Weak match",
        score: 0.4,
        metadata: { name: "Material 2" },
      },
    ]);

    const result = await skill.match({
      sectionText: "テスト台本テキスト",
      section: "hook",
      tenantId: "11111111-1111-1111-1111-111111111111",
      structureType: "ugc",
      concept: "テスト商品",
      targetAudience: "30代女性",
    });

    expect(result.needsMaterial).toBe(true);
    expect(result.selected?.score).toBe(0.4);
    expect(result.aiSuggestion).toBeDefined();
    expect(result.aiSuggestion?.type).toBe("image_only");
    expect(mockAiSuggestion.buildSuggestion).toHaveBeenCalled();
  });

  it("handles no results at all", async () => {
    (mockEmbedding.searchSimilarMaterials as any).mockResolvedValueOnce([]);

    const result = await skill.match({
      sectionText: "テスト台本テキスト",
      section: "hook",
      tenantId: "11111111-1111-1111-1111-111111111111",
      structureType: "ugc",
      concept: "テスト商品",
      targetAudience: "30代女性",
    });

    expect(result.needsMaterial).toBe(true);
    expect(result.selected).toBeNull();
    expect(result.existingCandidates).toHaveLength(0);
    expect(result.aiSuggestion).toBeDefined();
  });

  it("throws on invalid tenantId", async () => {
    await expect(
      skill.match({
        sectionText: "test",
        section: "hook",
        tenantId: "invalid",
        structureType: "ugc",
        concept: "test",
        targetAudience: "test",
      }),
    ).rejects.toThrow();
  });
});
