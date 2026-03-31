import { Client, isFullPage } from "@notionhq/client";
import type { AppConfig } from "../config.js";
import { normalizeNotionDbId } from "../config.js";
import { logger } from "../logger.js";

const NOTION_RETRY_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let delay = 1000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const status = err.status;
      const retry = status != null && NOTION_RETRY_STATUS.has(status);
      if (!retry || attempt === 5) throw e;
      logger.warn(`${label} retry`, { attempt, status });
      await sleep(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  }
  throw new Error("unreachable");
}

function chunkRichTextSegments(text: string, max = 2000): { type: "text"; text: { content: string } }[] {
  const segments: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += max) {
    segments.push({ type: "text", text: { content: text.slice(i, i + max) } });
  }
  if (segments.length === 0) segments.push({ type: "text", text: { content: "" } });
  return segments;
}

function richProp(name: string, text: string): Record<string, unknown> {
  return { [name]: { rich_text: chunkRichTextSegments(text) } };
}

export interface NotionRowPayload {
  title: string;
  summary: string;
  nextActions: string;
  recordedAtIso: string;
  durationText: string;
  soundcoreId: string;
  transcription: string;
}

export class NotionWriter {
  private client: Client;
  private dbId: string;
  private titlePropName: string | null = null;

  constructor(private cfg: AppConfig) {
    this.client = new Client({ auth: cfg.NOTION_TOKEN });
    this.dbId = normalizeNotionDbId(cfg.NOTION_DATABASE_ID);
  }

  private async ensureTitleProperty(): Promise<string> {
    if (this.titlePropName) return this.titlePropName;
    const db = await withRetry("databases.retrieve", () =>
      this.client.databases.retrieve({ database_id: this.dbId }),
    );
    const entry = Object.entries(db.properties).find(([, v]) => v.type === "title");
    if (!entry) throw new Error("Notion database has no title property");
    this.titlePropName = entry[0];
    return this.titlePropName;
  }

  private propsForPayload(titleName: string, p: NotionRowPayload): Record<string, unknown> {
    const P = this.cfg;
    return {
      [titleName]: { title: chunkRichTextSegments(p.title) },
      ...richProp(P.NOTION_PROP_SUMMARY, p.summary),
      ...richProp(P.NOTION_PROP_NEXT_ACTIONS, p.nextActions),
      [P.NOTION_PROP_RECORDED_AT]: {
        date: { start: p.recordedAtIso },
      },
      ...richProp(P.NOTION_PROP_DURATION, p.durationText),
      ...richProp(P.NOTION_PROP_SOUNDCORE_ID, p.soundcoreId),
    };
  }

  async findPageBySoundcoreId(soundcoreId: string): Promise<string | null> {
    const prop = this.cfg.NOTION_PROP_SOUNDCORE_ID;
    const res = await withRetry("databases.query", () =>
      this.client.databases.query({
        database_id: this.dbId,
        filter: {
          property: prop,
          rich_text: { equals: soundcoreId },
        },
        page_size: 1,
      }),
    );
    const page = res.results[0];
    if (page && isFullPage(page)) return page.id;
    return null;
  }

  private transcriptBlocks(transcription: string): object[] {
    const chunks: object[] = [];
    const max = 2000;
    for (let i = 0; i < transcription.length; i += max) {
      const part = transcription.slice(i, i + max);
      chunks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: part } }] },
      });
    }
    if (chunks.length === 0) {
      chunks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: "" } }] },
      });
    }
    return chunks;
  }

  async upsertRow(p: NotionRowPayload): Promise<void> {
    const titleName = await this.ensureTitleProperty();
    const properties = this.propsForPayload(titleName, p) as any;
    const existingId = await this.findPageBySoundcoreId(p.soundcoreId);

    const allBlocks = this.transcriptBlocks(p.transcription);
    const firstBlocks = allBlocks.slice(0, 100) as any;

    if (!existingId) {
      const created = await withRetry("pages.create", () =>
        this.client.pages.create({
          parent: { database_id: this.dbId },
          properties,
          children: firstBlocks,
        }),
      );
      logger.info("Notion page created", { soundcoreId: p.soundcoreId });
      await this.appendTranscriptBlockBatch(created.id, allBlocks, 100);
      return;
    }

    await withRetry("pages.update", () =>
      this.client.pages.update({
        page_id: existingId,
        properties,
      }),
    );
    await this.replacePageBody(existingId, p.transcription);
    logger.info("Notion page updated", { soundcoreId: p.soundcoreId });
  }

  private async appendTranscriptBlockBatch(
    pageId: string,
    allBlocks: object[],
    startBlockIndex: number,
  ): Promise<void> {
    for (let i = startBlockIndex; i < allBlocks.length; i += 100) {
      const batch = allBlocks.slice(i, i + 100) as any;
      await withRetry("blocks.children.append", () =>
        this.client.blocks.children.append({ block_id: pageId, children: batch }),
      );
    }
  }

  private async replacePageBody(pageId: string, transcription: string): Promise<void> {
    let cursor: string | undefined;
    const blockIds: string[] = [];
    do {
      const res = await withRetry("blocks.children.list", () =>
        this.client.blocks.children.list({ block_id: pageId, start_cursor: cursor }),
      );
      for (const b of res.results) {
        blockIds.push(b.id);
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    for (const id of blockIds) {
      await withRetry("blocks.delete", () => this.client.blocks.delete({ block_id: id }));
      await sleep(120);
    }

    const all = this.transcriptBlocks(transcription);
    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100) as any;
      await withRetry("blocks.children.append", () =>
        this.client.blocks.children.append({ block_id: pageId, children: batch }),
      );
    }
  }
}
