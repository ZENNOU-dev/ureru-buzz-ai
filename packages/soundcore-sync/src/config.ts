import { z } from "zod";
import { logger } from "./logger.js";

const envSchema = z
  .object({
    SOUNDCORE_EMAIL: z.string().email().optional(),
    SOUNDCORE_PASSWORD: z.string().optional(),
    /** Key exchange / OpenAPI crypto (from web bundle — see DESIGN.md) */
    SOUNDCORE_CC_HEX: z.string().optional(),
    SOUNDCORE_LOGIN_SERVER_PUB_HEX: z.string().optional(),
    /** Skip login: provide session material from a captured session (testing) */
    SOUNDCORE_SKIP_LOGIN: z.enum(["0", "1"]).optional(),
    SOUNDCORE_AUTH_TOKEN: z.string().optional(),
    SOUNDCORE_USER_ID: z.string().optional(),
    SOUNDCORE_KEY_IDENT: z.string().optional(),
    /** First 32 hex chars of ECDH shared secret (see DESIGN.md) */
    SOUNDCORE_SHARE_KEY_HEX: z.string().optional(),

    NOTION_TOKEN: z.string().min(1),
    NOTION_DATABASE_ID: z.string().min(1),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional().default("gemini-2.0-flash"),
  SUMMARY_MAX_CHARS: z.coerce.number().optional().default(1200),
  MAX_GENERATE_PER_RUN: z.coerce.number().optional().default(8),
  SOUNDCORE_LANGUAGE: z.string().optional().default("ja-JP"),

  HTTP_MODE: z.enum(["0", "1"]).optional(),
  PORT: z.coerce.number().optional().default(8080),
  CRON_SECRET: z.string().optional(),

  NOTION_PROP_SUMMARY: z.string().optional().default("要約"),
  NOTION_PROP_NEXT_ACTIONS: z.string().optional().default("ネクストアクション"),
  NOTION_PROP_RECORDED_AT: z.string().optional().default("録音日時"),
  NOTION_PROP_DURATION: z.string().optional().default("録音時間"),
  NOTION_PROP_SOUNDCORE_ID: z.string().optional().default("Soundcore ID"),
  })
  .superRefine((val, ctx) => {
    if (val.SOUNDCORE_SKIP_LOGIN === "1") {
      if (!val.SOUNDCORE_AUTH_TOKEN)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_AUTH_TOKEN required when SOUNDCORE_SKIP_LOGIN=1" });
      if (!val.SOUNDCORE_USER_ID)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_USER_ID required when SOUNDCORE_SKIP_LOGIN=1" });
      if (!val.SOUNDCORE_KEY_IDENT)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_KEY_IDENT required when SOUNDCORE_SKIP_LOGIN=1" });
      if (!val.SOUNDCORE_SHARE_KEY_HEX)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_SHARE_KEY_HEX required when SOUNDCORE_SKIP_LOGIN=1" });
    } else {
      if (!val.SOUNDCORE_EMAIL)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_EMAIL required unless SOUNDCORE_SKIP_LOGIN=1" });
      if (!val.SOUNDCORE_PASSWORD)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_PASSWORD required unless SOUNDCORE_SKIP_LOGIN=1" });
      if (!val.SOUNDCORE_CC_HEX)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SOUNDCORE_CC_HEX required unless SOUNDCORE_SKIP_LOGIN=1" });
      if (!val.SOUNDCORE_LOGIN_SERVER_PUB_HEX)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SOUNDCORE_LOGIN_SERVER_PUB_HEX required unless SOUNDCORE_SKIP_LOGIN=1",
        });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error("Invalid environment", { issues: parsed.error.flatten() });
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

/** Normalize Notion database ID to hyphenated UUID */
export function normalizeNotionDbId(id: string): string {
  const clean = id.replace(/-/g, "");
  if (clean.length !== 32 || !/^[0-9a-f]+$/i.test(clean)) return id;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}
