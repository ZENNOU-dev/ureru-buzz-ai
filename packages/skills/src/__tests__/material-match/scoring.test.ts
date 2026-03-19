import { describe, it, expect } from "vitest";
import { scoreCandidates } from "../../material-match/scoring.js";
import type { SimilarMaterialResult } from "../../material-match/embedding.js";

describe("scoreCandidates", () => {
  const makeMaterial = (id: string, score: number, text: string): SimilarMaterialResult => ({
    id,
    notionPageId: `notion-${id}`,
    driveFileId: `drive-${id}`,
    contentText: text,
    score,
    metadata: { name: `Material ${id}` },
  });

  it("returns empty array for empty results", () => {
    expect(scoreCandidates([], "test text")).toEqual([]);
  });

  it("sorts by score descending", () => {
    const results = [
      makeMaterial("low", 0.3, "低い素材"),
      makeMaterial("high", 0.9, "高い素材"),
      makeMaterial("mid", 0.6, "中間の素材"),
    ];

    const candidates = scoreCandidates(results, "テスト");
    expect(candidates[0].materialId).toBe("high");
    expect(candidates[1].materialId).toBe("mid");
    expect(candidates[2].materialId).toBe("low");
  });

  it("clamps score to 0-1 range", () => {
    const results = [makeMaterial("over", 1.5, "over"), makeMaterial("under", -0.1, "under")];
    const candidates = scoreCandidates(results, "test");
    expect(candidates[0].score).toBe(1);
    expect(candidates[1].score).toBe(0);
  });

  it("sets isAiGenerated to false for existing materials", () => {
    const results = [makeMaterial("a", 0.7, "test")];
    const candidates = scoreCandidates(results, "test");
    expect(candidates[0].isAiGenerated).toBe(false);
    expect(candidates[0].source).toBe("existing");
  });

  it("builds Google Drive URL from driveFileId", () => {
    const results = [makeMaterial("a", 0.7, "test")];
    const candidates = scoreCandidates(results, "test");
    expect(candidates[0].url).toContain("drive.google.com");
    expect(candidates[0].url).toContain("drive-a");
  });
});
