import { z } from "zod";

const envSchema = z.object({
  // Claude API
  ANTHROPIC_API_KEY: z.string().min(1),

  // Notion
  NOTION_API_KEY: z.string().min(1),

  // ureru-buzz-ai Supabase (READ/WRITE)
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Ad Orchestration Supabase (READ ONLY)
  AD_ORCH_SUPABASE_URL: z.string().url(),
  AD_ORCH_SUPABASE_KEY: z.string().min(1),

  // video-material-selector Supabase (READ ONLY)
  VMS_SUPABASE_URL: z.string().url(),
  VMS_SUPABASE_KEY: z.string().min(1),

  // Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),

  // Slack
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),

  // Meta Ads
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),

  // TikTok Ads
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  TIKTOK_ADVERTISER_ID: z.string().optional(),

  // Kling AI
  KLING_API_KEY: z.string().optional(),
  KLING_API_URL: z.string().url().default("https://api.klingai.com/v1"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // TTS
  TTS_API_KEY: z.string().optional(),
  TTS_PROVIDER: z.enum(["elevenlabs", "voicevox", "openai"]).default("elevenlabs"),

  // Remotion
  REMOTION_SERVE_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function loadEnvPartial(): Partial<Env> {
  return envSchema.partial().parse(process.env);
}

export { envSchema };
