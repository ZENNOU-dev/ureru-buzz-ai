import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withRetry, logger, VMS_EMBEDDING_DIMENSIONS } from "@ureru-buzz-ai/core";

export interface SimilarMaterialResult {
  id: string;
  notionPageId: string;
  driveFileId: string;
  contentText: string;
  score: number;
  metadata: {
    name?: string;
    project?: string;
    tags?: Record<string, string>;
  };
}

export class EmbeddingService {
  private vmsClient: SupabaseClient;
  private geminiApiKey?: string;

  constructor(vmsUrl: string, vmsKey: string, geminiApiKey?: string) {
    this.vmsClient = createClient(vmsUrl, vmsKey);
    this.geminiApiKey = geminiApiKey;
  }

  /**
   * Search similar materials in VMS material_vectors.
   *
   * Strategy:
   * 1. If Gemini API key available → generate 768-dim embedding → RPC vector search
   * 2. If RPC not available → fallback to text-based search (content_text + tags)
   * 3. If no API key → text-based search only
   */
  async searchSimilarMaterials(params: {
    queryText: string;
    queryEmbedding?: number[];
    tenantProjectName?: string;
    topK: number;
    threshold: number;
  }): Promise<SimilarMaterialResult[]> {
    // Try vector search first if embedding is available
    if (params.queryEmbedding && params.queryEmbedding.length === VMS_EMBEDDING_DIMENSIONS) {
      try {
        return await this.vectorSearch(params as Required<typeof params>);
      } catch (e) {
        logger.warn("embedding-vector-search-failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Fallback: text-based search
    return this.textBasedSearch(params);
  }

  /**
   * Vector search via Supabase RPC (match_material_vectors)
   */
  private async vectorSearch(params: {
    queryEmbedding: number[];
    tenantProjectName?: string;
    topK: number;
    threshold: number;
  }): Promise<SimilarMaterialResult[]> {
    return withRetry(async () => {
      // VMS's match_materials RPC: (query_embedding, match_threshold, match_count)
      const { data, error } = await this.vmsClient.rpc("match_materials", {
        query_embedding: JSON.stringify(params.queryEmbedding),
        match_threshold: params.threshold,
        match_count: params.topK,
      });

      if (error) {
        throw new Error(`RPC error: ${error.message}`);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id,
        notionPageId: row.notion_page_id,
        driveFileId: row.drive_file_id,
        contentText: row.content_text,
        score: row.similarity ?? (1 - (row.distance ?? 0)),
        metadata: row.metadata ?? {},
      }));
    }, { maxAttempts: 2, initialDelayMs: 1000 });
  }

  /**
   * Text-based fallback search using content_text and metadata tags.
   * Computes simple keyword overlap score.
   */
  private async textBasedSearch(params: {
    queryText: string;
    tenantProjectName?: string;
    topK: number;
    threshold: number;
  }): Promise<SimilarMaterialResult[]> {
    logger.info("embedding-text-search", { queryText: params.queryText.slice(0, 50) });

    let query = this.vmsClient
      .from("material_vectors")
      .select("id, notion_page_id, drive_file_id, content_text, metadata");

    if (params.tenantProjectName) {
      query = query.eq("metadata->>project", params.tenantProjectName);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      logger.error("embedding-text-search-error", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Score each material by keyword overlap with query text
    const queryKeywords = extractKeywords(params.queryText);
    const scored = data.map((row: any) => {
      const contentKeywords = extractKeywords(row.content_text ?? "");
      const tags = row.metadata?.tags ?? {};
      const tagValues = Object.values(tags).filter(Boolean) as string[];

      // Keyword overlap score
      let matchCount = 0;
      for (const qk of queryKeywords) {
        if (contentKeywords.has(qk)) matchCount++;
        if (tagValues.some((tv: string) => tv.includes(qk))) matchCount++;
      }

      const score = queryKeywords.size > 0
        ? Math.min(1, matchCount / queryKeywords.size)
        : 0;

      return {
        id: row.id,
        notionPageId: row.notion_page_id,
        driveFileId: row.drive_file_id,
        contentText: row.content_text,
        score,
        metadata: row.metadata ?? {},
      };
    });

    return scored
      .filter((s) => s.score >= params.threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK);
  }

  /**
   * Generate text embedding using Gemini API (768 dimensions, matching VMS)
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    if (!this.geminiApiKey) {
      logger.warn("embedding-no-gemini-key", {
        message: "Gemini API key not set, vector search will use text-based fallback",
      });
      return [];
    }

    return withRetry(async () => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${this.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            outputDimensionality: VMS_EMBEDDING_DIMENSIONS, // 768 to match VMS
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini embedding API error: ${response.status} ${body}`);
      }

      const data = await response.json();
      const embedding = data.embedding?.values;

      if (!Array.isArray(embedding)) {
        throw new Error("Unexpected Gemini embedding response format");
      }

      logger.info("embedding-generated", { dimensions: embedding.length });
      return embedding;
    }, { maxAttempts: 3, initialDelayMs: 1000 });
  }
}

/**
 * Extract meaningful keywords from Japanese text.
 * Uses character n-grams (bigrams) since we don't have a morphological analyzer.
 * Also extracts space-separated tokens for content_text which has space-delimited tags.
 */
function extractKeywords(text: string): Set<string> {
  const keywords = new Set<string>();

  // 1. Space/delimiter-separated tokens (for VMS content_text which has "人物 室内 演出" format)
  const tokens = text
    .replace(/[。、！？\n\r.,!?「」『』（）\[\]【】]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  for (const t of tokens) {
    keywords.add(t);
  }

  // 2. Character bigrams for Japanese text matching
  const cleaned = text.replace(/[\s\n\r。、！？.,!?「」『』（）\[\]【】]/g, "");
  for (let i = 0; i < cleaned.length - 1; i++) {
    keywords.add(cleaned.slice(i, i + 2));
  }

  return keywords;
}
