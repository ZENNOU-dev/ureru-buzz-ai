import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppConfig } from "../config.js";

function heuristicNextActions(text: string): string {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const hits = lines.filter(
    (l) =>
      /todo|TODO|次に|やること|対応|フォロー|確認|連絡|送る|予定/i.test(l) || /^[-*•]\s+/.test(l),
  );
  return hits.slice(0, 12).join("\n") || "";
}

export async function extractNextActions(cfg: AppConfig, summary: string, transcript: string): Promise<string> {
  const ctx = `${summary}\n\n${transcript}`.slice(0, 12_000);
  if (!cfg.GEMINI_API_KEY) {
    return heuristicNextActions(ctx);
  }
  try {
    const gen = new GoogleGenerativeAI(cfg.GEMINI_API_KEY);
    const model = gen.getGenerativeModel({ model: cfg.GEMINI_MODEL });
    const prompt =
      "会議・録音の内容から、具体的なネクストアクションだけを箇条書きで日本語で抽出してください。最大10項目。該当がなければ空に近い1行で「特になし」とだけ書いてください。\n\n---\n" +
      ctx;
    const res = await model.generateContent(prompt);
    return res.response.text().trim();
  } catch {
    return heuristicNextActions(ctx);
  }
}
