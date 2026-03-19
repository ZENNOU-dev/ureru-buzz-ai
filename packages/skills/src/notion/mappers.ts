import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import type {
  NotionScriptRecord,
  NotionEditBriefRecord,
  NotionCut,
  NotionBgm,
  NotionMaterialRecord,
} from "@ureru-buzz-ai/core";
import { SCRIPT_DB_PROPS, EDIT_BRIEF_DB_PROPS, MATERIAL_DB_PROPS } from "./types.js";

type Props = PageObjectResponse["properties"];

// Helper to extract property values
function getRichText(props: Props, name: string): string {
  const prop = props[name];
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t: any) => t.plain_text).join("");
  }
  if (prop?.type === "title") {
    return prop.title.map((t: any) => t.plain_text).join("");
  }
  return "";
}

function getNumber(props: Props, name: string): number {
  const prop = props[name];
  if (prop?.type === "number") {
    return prop.number ?? 0;
  }
  return 0;
}

function getSelect(props: Props, name: string): string {
  const prop = props[name];
  if (prop?.type === "select") {
    return prop.select?.name ?? "";
  }
  return "";
}

function getMultiSelect(props: Props, name: string): string[] {
  const prop = props[name];
  if (prop?.type === "multi_select") {
    return prop.multi_select.map((s: any) => s.name);
  }
  return [];
}

function getUrl(props: Props, name: string): string {
  const prop = props[name];
  if (prop?.type === "url") {
    return prop.url ?? "";
  }
  return "";
}

function getRelation(props: Props, name: string): string {
  const prop = props[name];
  if (prop?.type === "relation" && prop.relation.length > 0) {
    return prop.relation[0].id;
  }
  return "";
}

/**
 * Map Notion page to NotionScriptRecord
 */
export function mapToNotionScriptRecord(page: PageObjectResponse): NotionScriptRecord {
  const props = page.properties;
  return {
    tenantId: getRichText(props, SCRIPT_DB_PROPS.tenantId),
    planId: getRelation(props, SCRIPT_DB_PROPS.planId) || getRichText(props, SCRIPT_DB_PROPS.planId),
    scriptText: getRichText(props, SCRIPT_DB_PROPS.scriptText),
    hookVariation: getNumber(props, SCRIPT_DB_PROPS.hookVariation),
    hookText: getRichText(props, SCRIPT_DB_PROPS.hookText),
    interestType: getSelect(props, SCRIPT_DB_PROPS.interestType),
    charCount: getNumber(props, SCRIPT_DB_PROPS.charCount),
    annotations: getMultiSelect(props, SCRIPT_DB_PROPS.annotations),
    status: getSelect(props, SCRIPT_DB_PROPS.status),
  };
}

/**
 * Build Notion properties for EditBrief creation
 */
export function buildEditBriefProperties(record: NotionEditBriefRecord): Record<string, unknown> {
  return {
    [EDIT_BRIEF_DB_PROPS.tenantId]: {
      rich_text: [{ text: { content: record.tenantId } }],
    },
    [EDIT_BRIEF_DB_PROPS.title]: {
      title: [{ text: { content: `EditBrief-${record.scriptId.slice(0, 8)}` } }],
    },
    [EDIT_BRIEF_DB_PROPS.scriptId]: {
      rich_text: [{ text: { content: record.scriptId } }],
    },
    [EDIT_BRIEF_DB_PROPS.cuts]: {
      rich_text: [{ text: { content: JSON.stringify(record.cuts).slice(0, 2000) } }],
    },
    [EDIT_BRIEF_DB_PROPS.bgm]: {
      rich_text: [{ text: { content: record.bgm ? JSON.stringify(record.bgm) : "" } }],
    },
    [EDIT_BRIEF_DB_PROPS.totalCharCount]: {
      number: record.totalCharCount,
    },
    [EDIT_BRIEF_DB_PROPS.status]: {
      select: { name: record.status },
    },
  };
}

/**
 * Map Notion page to NotionMaterialRecord
 */
export function mapToNotionMaterialRecord(page: PageObjectResponse): NotionMaterialRecord {
  const props = page.properties;
  return {
    tenantId: getRichText(props, MATERIAL_DB_PROPS.tenantId),
    name: getRichText(props, MATERIAL_DB_PROPS.name),
    format: getSelect(props, MATERIAL_DB_PROPS.format) as NotionMaterialRecord["format"],
    genre: getRichText(props, MATERIAL_DB_PROPS.genre) || undefined,
    description: getRichText(props, MATERIAL_DB_PROPS.description) || undefined,
    cast: getRichText(props, MATERIAL_DB_PROPS.cast) || undefined,
    status: getSelect(props, MATERIAL_DB_PROPS.status),
    url: getUrl(props, MATERIAL_DB_PROPS.url),
    driveFileId: getRichText(props, MATERIAL_DB_PROPS.driveFileId) || undefined,
    aiGeneratedSource: getRichText(props, MATERIAL_DB_PROPS.aiGeneratedSource) || undefined,
  };
}
