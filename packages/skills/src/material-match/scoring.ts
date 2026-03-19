import type { MaterialCandidate } from "./types.js";
import type { SimilarMaterialResult } from "./embedding.js";

/**
 * Score and rank material candidates from vector search results
 * MVP: Uses only content match (axis 3). Axes 1 & 2 deferred.
 */
export function scoreCandidates(
  rawResults: SimilarMaterialResult[],
  sectionText: string,
): MaterialCandidate[] {
  if (rawResults.length === 0) return [];

  return rawResults
    .map((result) => {
      // Normalize score to 0-1 range (cosine similarity already in this range)
      const score = Math.max(0, Math.min(1, result.score));

      // Generate human-readable reason
      const reason = buildReason(result, sectionText, score);

      return {
        materialId: result.id,
        materialName: result.metadata?.name ?? result.contentText?.slice(0, 50),
        url: buildMaterialUrl(result.driveFileId),
        score,
        reason,
        isAiGenerated: false,
        source: "existing",
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildReason(
  result: SimilarMaterialResult,
  sectionText: string,
  score: number,
): string {
  const parts: string[] = [];

  if (score >= 0.8) {
    parts.push("高い類似度");
  } else if (score >= 0.6) {
    parts.push("中程度の類似度");
  } else {
    parts.push("低い類似度");
  }

  if (result.metadata?.tags) {
    const tags = result.metadata.tags;
    const relevantTags = Object.entries(tags)
      .filter(([_, v]) => v && sectionText.includes(v))
      .map(([k, v]) => `${k}:${v}`);
    if (relevantTags.length > 0) {
      parts.push(`タグ一致: ${relevantTags.join(", ")}`);
    }
  }

  parts.push(`コンテンツ: "${result.contentText?.slice(0, 40)}..."`);
  return parts.join(" / ");
}

function buildMaterialUrl(driveFileId: string): string {
  if (!driveFileId) return "";
  return `https://drive.google.com/file/d/${driveFileId}/view`;
}
