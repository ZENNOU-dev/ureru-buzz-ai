import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withRetry, logger, EMBEDDING_DIMENSIONS } from "@ureru-buzz-ai/core";

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
  private openaiApiKey?: string;

  constructor(vmsUrl: string, vmsKey: string, openaiApiKey?: string) {
    this.vmsClient = createClient(vmsUrl, vmsKey);
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Search similar materials in VMS material_vectors using pgvector
   */
  async searchSimilarMaterials(params: {
    queryEmbedding: number[];
    tenantProjectName?: string;
    topK: number;
    threshold: number;
  }): Promise<SimilarMaterialResult[]> {
    return withRetry(async () => {
      // Use Supabase RPC for vector similarity search
      const { data, error } = await this.vmsClient.rpc("match_materials", {
        query_embedding: params.queryEmbedding,
        match_threshold: params.threshold,
        match_count: params.topK,
        filter_project: params.tenantProjectName ?? null,
      });

      if (error) {
        // Fallback: direct query if RPC doesn't exist yet
        logger.warn("embedding-rpc-fallback", { error: error.message });
        return this.fallbackSearch(params);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id,
        notionPageId: row.notion_page_id,
        driveFileId: row.drive_file_id,
        contentText: row.content_text,
        score: 1 - (row.distance ?? 0), // cosine distance to similarity
        metadata: row.metadata ?? {},
      }));
    }, { maxAttempts: 2, initialDelayMs: 1000 });
  }

  /**
   * Fallback: direct table query when RPC is not available
   */
  private async fallbackSearch(params: {
    queryEmbedding: number[];
    tenantProjectName?: string;
    topK: number;
    threshold: number;
  }): Promise<SimilarMaterialResult[]> {
    let query = this.vmsClient
      .from("material_vectors")
      .select("id, notion_page_id, drive_file_id, content_text, metadata");

    if (params.tenantProjectName) {
      query = query.eq("metadata->>project", params.tenantProjectName);
    }

    const { data, error } = await query.limit(params.topK * 3); // Get more, filter by threshold in app

    if (error) {
      logger.error("embedding-fallback-error", error);
      return [];
    }

    // Without pgvector RPC, return all with score 0.5 (placeholder)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      notionPageId: row.notion_page_id,
      driveFileId: row.drive_file_id,
      contentText: row.content_text,
      score: 0.5, // Placeholder when vector search unavailable
      metadata: row.metadata ?? {},
    }));
  }

  /**
   * Generate text embedding using OpenAI API
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    if (!this.openaiApiKey) {
      logger.warn("embedding-no-api-key", { message: "OpenAI API key not set, returning zero vector" });
      return new Array(EMBEDDING_DIMENSIONS).fill(0);
    }

    return withRetry(async () => {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-large",
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    }, { maxAttempts: 3, initialDelayMs: 1000 });
  }
}
