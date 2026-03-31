import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppConfig } from "../config.js";

export async function ensureNotionSummary(cfg: AppConfig, rawSummary: string, transcriptFallback: string): Promise<string> {
  const max = cfg.SUMMARY_MAX_CHARS;
  const base = (rawSummary || "").trim() || (transcriptFallback || "").trim().slice(0, max);
  if (!cfg.GEMINI_API_KEY) {
    return base.length > max ? base.slice(0, max) : base;
  }
  try {
    const gen = new GoogleGenerativeAI(cfg.GEMINI_API_KEY);
    const model = gen.getGenerativeModel({ model: cfg.GEMINI_MODEL });
    const prompt = `以下をNotionの「要約」欄向けに、${max}文字以内で簡潔に日本語で要約してください。箇条書き可。\n\n---\n${base.slice(0, 8000)}`;
    const res = await model.generateContent(prompt);
    const text = res.response.text().trim();
    return text.length > max ? text.slice(0, max) : text;
  } catch {
    return base.length > max ? base.slice(0, max) : base;
  }
}
