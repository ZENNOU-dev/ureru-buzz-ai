import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse, QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints.js";
import {
  getNotionLimiter,
  withRetry,
  logger,
  NotionError,
  NotionRateLimitError,
} from "@ureru-buzz-ai/core";
export class NotionSkill {
  private client: Client;
  private limiter: ReturnType<typeof getNotionLimiter>;

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey });
    this.limiter = getNotionLimiter();
  }

  /**
   * Query a Notion database with automatic pagination
   */
  async queryDatabase(params: {
    databaseId: string;
    filter?: QueryDatabaseParameters["filter"];
    sorts?: QueryDatabaseParameters["sorts"];
    pageSize?: number;
  }): Promise<PageObjectResponse[]> {
    const results: PageObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.rateLimitedCall(() =>
        this.client.databases.query({
          database_id: params.databaseId,
          filter: params.filter,
          sorts: params.sorts,
          page_size: params.pageSize ?? 100,
          start_cursor: cursor,
        }),
      );

      for (const page of response.results) {
        if (isFullPage(page)) {
          results.push(page);
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return results;
  }

  /**
   * Get a single page
   */
  async getPage(pageId: string): Promise<PageObjectResponse> {
    const response = await this.rateLimitedCall(() =>
      this.client.pages.retrieve({ page_id: pageId }),
    );

    if (!isFullPage(response)) {
      throw new NotionError(`Page ${pageId} is not a full page`);
    }

    return response;
  }

  /**
   * Create a page in a database
   */
  async createPage(params: {
    databaseId: string;
    properties: Record<string, unknown>;
    children?: object[];
  }): Promise<string> {
    const response = await this.rateLimitedCall(() =>
      this.client.pages.create({
        parent: { database_id: params.databaseId },
        properties: params.properties as any,
        children: params.children as any,
      }),
    );

    return response.id;
  }

  /**
   * Update a page's properties
   */
  async updatePage(params: {
    pageId: string;
    properties: Record<string, unknown>;
  }): Promise<void> {
    await this.rateLimitedCall(() =>
      this.client.pages.update({
        page_id: params.pageId,
        properties: params.properties as any,
      }),
    );
  }

  /**
   * Wrap API call with rate limiter + retry
   */
  private async rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.add(
      () =>
        withRetry(fn, {
          maxAttempts: 3,
          initialDelayMs: 1000,
          shouldRetry: (error: unknown) => {
            if (error && typeof error === "object" && "status" in error) {
              const status = (error as { status: number }).status;
              if (status === 429) {
                logger.warn("notion-rate-limited", { message: "Notion API rate limited, retrying" });
                return true;
              }
              if (status >= 500) return true;
            }
            return false;
          },
        }),
      { throwOnTimeout: true },
    ) as Promise<T>;
  }
}
