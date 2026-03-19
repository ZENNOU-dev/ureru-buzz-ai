/**
 * Sprint 1 完全E2Eテスト（カット単位DB対応）
 *
 * 台本 → セクション分割 → 素材マッチング → 編集概要マスター + カットDB書き込み
 */
import "dotenv/config";

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const SCRIPT_DB_ID = process.env.NOTION_SCRIPT_DB_ID!;
const MASTER_DB_ID = process.env.NOTION_EDIT_BRIEF_MASTER_DB_ID!;
const CUT_DB_ID = process.env.NOTION_EDIT_BRIEF_CUT_DB_ID!;

async function notionCreate(dbId: string, properties: Record<string, unknown>): Promise<{ id: string; url: string }> {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion create error: ${response.status} ${err}`);
  }
  return response.json() as Promise<{ id: string; url: string }>;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   Sprint 1 完全E2Eフロー（カット単位DB対応）         ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // --- Step 1: 台本取得 ---
  const { NotionSkill, mapToNotionScriptRecord } = await import("../packages/skills/src/notion/index.js");
  const notion = new NotionSkill(NOTION_API_KEY);
  const pages = await notion.queryDatabase({
    databaseId: SCRIPT_DB_ID,
    filter: { property: "ステータス", select: { equals: "承認済" } },
  });
  const script = mapToNotionScriptRecord(pages[0]);
  const scriptPageId = pages[0].id;
  console.log(`✅ 台本取得: ${script.scriptText.slice(0, 40)}... (${script.charCount}文字)\n`);

  // --- Step 2: セクション分割 ---
  const { parseScriptIntoSections } = await import("../packages/agents/src/edit-brief/script-parser.js");
  const sections = parseScriptIntoSections(script.scriptText);
  console.log(`✅ セクション分割: ${sections.length}セクション\n`);

  // --- Step 3: 全セクション素材マッチング ---
  const { EmbeddingService } = await import("../packages/skills/src/material-match/embedding.js");
  const { scoreCandidates } = await import("../packages/skills/src/material-match/scoring.js");
  const embedding = new EmbeddingService(
    process.env.VMS_SUPABASE_URL!,
    process.env.VMS_SUPABASE_KEY!,
    process.env.GEMINI_API_KEY,
  );

  const cutResults: Array<{
    section: string;
    text: string;
    charCount: number;
    material1Name: string;
    material1Url: string;
    material2Name: string;
    material2Url: string;
    score: number;
    telop: string;
  }> = [];

  for (const section of sections) {
    const emb = await embedding.generateTextEmbedding(section.text);
    const results = await embedding.searchSimilarMaterials({
      queryText: section.text,
      queryEmbedding: emb.length > 0 ? emb : undefined,
      topK: 3,
      threshold: 0.0,
      tenantProjectName: "05_債務整理",
    });
    const candidates = scoreCandidates(results, section.text);

    const m1 = candidates[0];
    const m2 = candidates[1];

    // テロップはテキストの改行を / に変換
    const telop = section.text
      .split(/[。！？]/)
      .filter(Boolean)
      .map((s) => s.trim())
      .join("\n/\n");

    cutResults.push({
      section: section.section,
      text: section.text,
      charCount: section.text.length,
      material1Name: m1?.materialName ?? "",
      material1Url: m1?.url ?? "",
      material2Name: m2?.materialName ?? "",
      material2Url: m2?.url ?? "",
      score: m1?.score ?? 0,
      telop,
    });

    const icon = (m1?.score ?? 0) >= 0.6 ? "✅" : "⚠️";
    console.log(`  ${icon} [${section.section}] → ${m1?.materialName ?? "なし"} (${(m1?.score ?? 0).toFixed(2)})`);
  }

  console.log(`\n✅ 素材マッチング完了\n`);

  // --- Step 4: マスターDB書き込み ---
  const totalCharCount = cutResults.reduce((sum, c) => sum + c.charCount, 0);
  const masterResult = await notionCreate(MASTER_DB_ID, {
    "編集概要名": { title: [{ text: { content: `【債務整理】借金減額_UGC_フック1` } }] },
    "テナントID": { rich_text: [{ text: { content: "11111111-1111-1111-1111-111111111111" } }] },
    "台本ID": { rich_text: [{ text: { content: scriptPageId } }] },
    "全体文字数": { number: totalCharCount },
    "話者設定": { rich_text: [{ text: { content: "信頼感のある男性ナレーター" } }] },
    "音声ファイル": { rich_text: [{ text: { content: "debt_relief_narrator.m4a" } }] },
    "BGM名": { rich_text: [{ text: { content: "Emotional Acoustic" } }] },
    "BGM_URL": { url: "https://example.com/bgm/emotional-acoustic.mp3" },
    "ステータス": { select: { name: "承認待ち" } },
  });

  console.log(`✅ マスターDB書き込み: ${masterResult.id}\n`);

  // --- Step 5: カットDB書き込み（1カット=1レコード） ---
  console.log("カットDB書き込み中...");
  const cutPageIds: string[] = [];

  for (let i = 0; i < cutResults.length; i++) {
    const cut = cutResults[i];
    const cutName = `${cut.section}_${i + 1}`;

    const cutResult = await notionCreate(CUT_DB_ID, {
      "カット名": { title: [{ text: { content: cutName } }] },
      "テナントID": { rich_text: [{ text: { content: "11111111-1111-1111-1111-111111111111" } }] },
      "編集概要ID": { rich_text: [{ text: { content: masterResult.id } }] },
      "カット番号": { number: i + 1 },
      "文字数": { number: cut.charCount },
      "テキスト": { rich_text: [{ text: { content: cut.text.slice(0, 2000) } }] },
      "注釈": { rich_text: [{ text: { content: "" } }] },
      "レギュチェック欄": { select: { name: "未確認" } },
      "素材名①": { rich_text: [{ text: { content: cut.material1Name } }] },
      "素材①URL": cut.material1Url ? { url: cut.material1Url } : { url: null },
      "素材名②": { rich_text: [{ text: { content: cut.material2Name } }] },
      "素材②URL": cut.material2Url ? { url: cut.material2Url } : { url: null },
      "テロップ": { rich_text: [{ text: { content: cut.telop.slice(0, 2000) } }] },
      "モーションエフェクト": { rich_text: [{ text: { content: "" } }] },
      "効果音": { rich_text: [{ text: { content: "" } }] },
      "その他編集指示": { rich_text: [{ text: { content: "" } }] },
      "素材スコア": { number: Math.round(cut.score * 100) / 100 },
      "AI生成提案": { rich_text: [{ text: { content: cut.score < 0.6 ? "AI生成を推奨" : "" } }] },
      "AI生成済み": { checkbox: false },
    });

    cutPageIds.push(cutResult.id);
    console.log(`  ✅ カット${i + 1}: [${cut.section}] → ${cutName}`);

    await new Promise((r) => setTimeout(r, 350)); // rate limit
  }

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   完了！                                              ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║ マスター: ${masterResult.id.slice(0, 20)}...`);
  console.log(`║ カット数: ${cutPageIds.length}`);
  console.log(`║ 全体文字数: ${totalCharCount}`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`\n🔗 Notionで確認:`);
  console.log(`   カットDB: https://www.notion.so/${CUT_DB_ID.replace(/-/g, "")}`);
}

main().catch((err) => {
  console.error("\n❌ エラー:", err);
  process.exit(1);
});
