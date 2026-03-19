import type { NotionBgm } from "@ureru-buzz-ai/core";

// Import LLMSkill type
interface LLMSkillLike {
  generate(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
}

// MVP: Predefined BGM library (will be replaced by Notion DB query later)
const BGM_LIBRARY: NotionBgm[] = [
  { name: "Upbeat Pop", url: "bgm/upbeat-pop.mp3", volume: 0.25 },
  { name: "Calm Piano", url: "bgm/calm-piano.mp3", volume: 0.2 },
  { name: "Energetic EDM", url: "bgm/energetic-edm.mp3", volume: 0.3 },
  { name: "Dramatic Orchestral", url: "bgm/dramatic-orchestral.mp3", volume: 0.2 },
  { name: "Trendy Lo-Fi", url: "bgm/trendy-lofi.mp3", volume: 0.25 },
  { name: "Corporate Positive", url: "bgm/corporate-positive.mp3", volume: 0.2 },
  { name: "Emotional Acoustic", url: "bgm/emotional-acoustic.mp3", volume: 0.2 },
  { name: "TikTok Viral Beat", url: "bgm/tiktok-viral.mp3", volume: 0.3 },
];

/**
 * Select appropriate BGM for the edit brief
 * MVP: Uses LLM to pick from predefined library
 */
export async function selectBgm(
  llm: LLMSkillLike,
  scriptSummary: string,
  structureType: string,
  interestType: string,
): Promise<NotionBgm> {
  const bgmNames = BGM_LIBRARY.map((b) => b.name).join(", ");

  const selectedName = await llm.generate({
    systemPrompt: `BGMライブラリから最適な1曲を選んでください。曲名のみを回答してください。
選択肢: ${bgmNames}`,
    userPrompt: `台本概要: ${scriptSummary}
構成の型: ${structureType}
興味の型: ${interestType}

最適なBGM名を1つだけ回答:`,
    temperature: 0.3,
    maxTokens: 50,
  });

  // Find matching BGM
  const match = BGM_LIBRARY.find(
    (b) => selectedName.includes(b.name) || b.name.includes(selectedName.trim()),
  );

  return match ?? BGM_LIBRARY[0]; // Default to first if no match
}
