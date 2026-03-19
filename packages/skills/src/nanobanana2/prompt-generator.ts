import type { LLMSkill } from "../llm/client.js";
import type { PromptGeneratorInput } from "./types.js";

/**
 * Generate an image generation prompt from script section context
 * Uses LLMSkill to create NanoBanana2-optimized prompts
 */
export async function generateMaterialPrompt(
  llm: LLMSkill,
  input: PromptGeneratorInput,
): Promise<string> {
  return llm.generate({
    systemPrompt: `あなたは広告用ビジュアル素材のプロンプトエンジニアです。
台本セクションに最適な画像生成プロンプトを英語で作成してください。

ルール:
- 9:16の縦型フォーマットを前提
- 広告らしいクリーンで高品質な画像
- テキストオーバーレイの余白を確保（上部1/4と下部1/4は空ける）
- 構成の型「${input.structureType}」に合ったスタイル
- UGC/インフルエンサー型はリアルな写真風、アニメ/イラスト型はその画風
- 人物が含まれる場合は日本人を想定
- プロンプトは1段落、3-5文で記述`,
    userPrompt: `セクション: ${input.section}
台本テキスト: "${input.scriptText}"
構成の型: ${input.structureType}
コンセプト: ${input.concept}
ターゲット: ${input.targetAudience}

上記に最適な画像生成プロンプトを英語で出力してください。`,
    temperature: 0.8,
  });
}
