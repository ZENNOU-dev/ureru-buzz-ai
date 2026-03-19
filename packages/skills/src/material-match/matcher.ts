import { MATERIAL_MATCH_THRESHOLD, ensureTenantId, logger } from "@ureru-buzz-ai/core";
import type { MaterialMatchInput, MaterialMatchResult } from "./types.js";
import type { EmbeddingService } from "./embedding.js";
import { scoreCandidates } from "./scoring.js";
import type { AiSuggestionBuilder } from "./ai-suggestion.js";

export class MaterialMatchSkill {
  constructor(
    private embeddingService: EmbeddingService,
    private aiSuggestionBuilder: AiSuggestionBuilder,
  ) {}

  /**
   * Match materials for a script section
   * Returns existing candidates + AI generation proposal if needed
   */
  async match(input: MaterialMatchInput): Promise<MaterialMatchResult> {
    ensureTenantId(input.tenantId);
    const topK = input.topK ?? 5;

    logger.info("material-match-start", {
      section: input.section,
      tenantId: input.tenantId,
      sectionText: input.sectionText.slice(0, 50),
    });

    // 1. Generate embedding for section text (may return empty if no API key)
    const queryEmbedding = await this.embeddingService.generateTextEmbedding(
      input.sectionText,
    );

    // 2. Search similar materials in VMS (vector search or text-based fallback)
    const rawResults = await this.embeddingService.searchSimilarMaterials({
      queryText: input.sectionText,
      queryEmbedding: queryEmbedding.length > 0 ? queryEmbedding : undefined,
      topK,
      threshold: 0.0, // Get all results, filter by threshold in scoring
    });

    // 3. Score candidates
    const existingCandidates = scoreCandidates(rawResults, input.sectionText);

    // 4. Determine if material is sufficient
    const bestMatch = existingCandidates[0] ?? null;
    const hasSufficientMatch = bestMatch !== null && bestMatch.score >= MATERIAL_MATCH_THRESHOLD;

    // 5. Build result
    const result: MaterialMatchResult = {
      existingCandidates,
      selected: bestMatch,
      needsMaterial: !hasSufficientMatch,
    };

    // 6. If material is insufficient, build AI suggestion
    if (!hasSufficientMatch) {
      logger.info("material-match-needs-ai", {
        section: input.section,
        bestScore: bestMatch?.score ?? 0,
        threshold: MATERIAL_MATCH_THRESHOLD,
      });
      result.aiSuggestion = await this.aiSuggestionBuilder.buildSuggestion(input);
    }

    logger.info("material-match-complete", {
      section: input.section,
      candidateCount: existingCandidates.length,
      selectedScore: bestMatch?.score ?? 0,
      needsMaterial: result.needsMaterial,
    });

    return result;
  }
}
