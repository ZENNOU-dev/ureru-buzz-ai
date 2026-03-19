import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withRetry, logger } from "@ureru-buzz-ai/core";

export interface LLMGenerateParams {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMStructuredParams<T> extends LLMGenerateParams {
  schema: z.ZodSchema<T>;
}

export class LLMSkill {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Generate text completion
   */
  async generate(params: LLMGenerateParams): Promise<string> {
    const response = await withRetry(
      () =>
        this.client.messages.create({
          model: params.model ?? "claude-sonnet-4-20250514",
          max_tokens: params.maxTokens ?? 4096,
          temperature: params.temperature ?? 0.7,
          system: params.systemPrompt,
          messages: [{ role: "user", content: params.userPrompt }],
        }),
      { maxAttempts: 3, initialDelayMs: 1000 },
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in LLM response");
    }

    return textBlock.text;
  }

  /**
   * Generate structured output with Zod validation
   * Retries with corrective prompt on parse failure
   */
  async generateStructured<T>(params: LLMStructuredParams<T>): Promise<T> {
    const maxParseRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxParseRetries; attempt++) {
      const userPrompt =
        attempt === 0
          ? `${params.userPrompt}\n\nJSON形式で回答してください。コードブロックは不要です。`
          : `${params.userPrompt}\n\n前回の回答はJSONパースに失敗しました。エラー: ${lastError?.message}\n\n正しいJSON形式で回答してください。コードブロックやマークダウンは含めないでください。`;

      const text = await this.generate({ ...params, userPrompt });

      try {
        // Strip markdown code blocks if present
        const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
        const parsed = JSON.parse(cleaned);
        return params.schema.parse(parsed);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("llm-structured-parse-failed", {
          attempt,
          error: lastError.message,
        });
      }
    }

    throw new Error(`Failed to parse structured LLM output after ${maxParseRetries + 1} attempts: ${lastError?.message}`);
  }
}
