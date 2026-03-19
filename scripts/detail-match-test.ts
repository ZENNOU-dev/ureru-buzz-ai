/**
 * 全セクション × 素材マッチング 詳細結果
 */
import "dotenv/config";

async function main() {
  const { NotionSkill, mapToNotionScriptRecord } = await import("../packages/skills/src/notion/index.js");
  const { parseScriptIntoSections } = await import("../packages/agents/src/edit-brief/script-parser.js");
  const { EmbeddingService } = await import("../packages/skills/src/material-match/embedding.js");
  const { scoreCandidates } = await import("../packages/skills/src/material-match/scoring.js");

  const notion = new NotionSkill(process.env.NOTION_API_KEY!);
  const embedding = new EmbeddingService(
    process.env.VMS_SUPABASE_URL!,
    process.env.VMS_SUPABASE_KEY!,
    process.env.GEMINI_API_KEY,
  );

  // 台本取得
  const pages = await notion.queryDatabase({
    databaseId: process.env.NOTION_SCRIPT_DB_ID!,
    filter: { property: "ステータス", select: { equals: "承認済" } },
  });
  const script = mapToNotionScriptRecord(pages[0]);
  const sections = parseScriptIntoSections(script.scriptText);

  console.log("");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║   全セクション × 素材マッチング 詳細結果                        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");

  let totalSections = 0;
  let sufficientCount = 0;
  let needsAiCount = 0;

  for (const section of sections) {
    totalSections++;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 [${section.section.toUpperCase()}]`);
    console.log(`   台本: ${section.text.slice(0, 80)}...`);
    console.log("");

    const emb = await embedding.generateTextEmbedding(section.text);
    const results = await embedding.searchSimilarMaterials({
      queryText: section.text,
      queryEmbedding: emb.length > 0 ? emb : undefined,
      topK: 3,
      threshold: 0.0,
      tenantProjectName: "05_債務整理",
    });

    const candidates = scoreCandidates(results, section.text);

    if (candidates.length === 0) {
      console.log(`   ❌ 素材なし → AI生成が必要`);
      needsAiCount++;
    } else {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const icon = c.score >= 0.6 ? "✅" : "⚠️";
        const rank = i === 0 ? "→ 選定" : `   候補${i + 1}`;
        console.log(`   ${icon} ${rank}: ${c.materialName} (score: ${c.score.toFixed(2)})`);
      }

      const best = candidates[0];
      if (best.score >= 0.6) {
        sufficientCount++;
        console.log(`   📌 判定: 既存素材で十分（閾値0.6超え）`);
      } else {
        needsAiCount++;
        console.log(`   📌 判定: AI生成を提案（閾値0.6未満）`);
      }
    }
    console.log("");
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 サマリー:`);
  console.log(`   全セクション: ${totalSections}`);
  console.log(`   既存素材で十分: ${sufficientCount}`);
  console.log(`   AI生成が必要: ${needsAiCount}`);
  console.log(`   素材充足率: ${((sufficientCount / totalSections) * 100).toFixed(0)}%`);
  console.log("");
}

main().catch(console.error);
