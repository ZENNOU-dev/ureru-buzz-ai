import { z } from "zod";
import type { NotionCut, ScriptSection } from "@ureru-buzz-ai/core";

// Import LLMSkill type
interface LLMSkillLike {
  generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodSchema<T>;
    temperature?: number;
  }): Promise<T>;
}

const cutDetailsSchema = z.array(
  z.object({
    subtitleText: z.string(),
    subtitleStyle: z.string(),
    effects: z.array(z.string()),
    soundEffects: z.array(z.string()),
    durationSeconds: z.number(),
  }),
);

type CutDetails = z.infer<typeof cutDetailsSchema>;

/**
 * Generate subtitle text, style, effects, and timing for each cut
 */
export async function generateSubtitles(
  llm: LLMSkillLike,
  cuts: Array<{ section: ScriptSection; scriptText: string; materialUrl?: string }>,
  structureType: string,
): Promise<CutDetails> {
  const result = await llm.generateStructured({
    systemPrompt: `あなたはショート動画広告の編集ディレクターです。
各カットに対して以下を生成してください:

- subtitleText: テロップに表示するテキスト（台本を要約/強調形に変換。重要語句は【】で囲む）
- subtitleStyle: テロップスタイル（例: "white-bold-center", "yellow-impact-bottom", "gradient-top"）
- effects: 映像エフェクト配列（例: ["zoom_in", "shake", "fade_in"]）
- soundEffects: 効果音配列（例: ["ポン", "ドン", "キラキラ"]）。不要なら空配列
- durationSeconds: このカットの秒数（日本語は1秒4文字を基準。全カット合計60秒以内）

構成の型「${structureType}」に合ったスタイルを選択してください。
UGC型: カジュアルなテロップ、手書き風
ドラマ型: シネマティックなテロップ
アニメ型: 派手なエフェクト、太字テロップ`,
    userPrompt: JSON.stringify(
      cuts.map((c) => ({ section: c.section, text: c.scriptText })),
    ),
    schema: cutDetailsSchema,
    temperature: 0.6,
  });

  return result;
}
