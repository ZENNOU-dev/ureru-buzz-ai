/**
 * Sprint 1 E2E テスト
 *
 * 台本DB → セクション分割 → VMS素材マッチ(Gemini embedding) →
 * 編集概要マスターDB + 編集概要カットDB 書き込み
 *
 * Usage: npx tsx scripts/e2e-sprint1.ts
 */
import "dotenv/config";
import { NotionSkill } from "../packages/skills/src/notion/client.js";
import {
  mapToNotionScriptRecord,
  buildEditBriefMasterProperties,
  buildEditBriefCutProperties,
} from "../packages/skills/src/notion/mappers.js";
import { parseScriptIntoSections } from "../packages/agents/src/edit-brief/script-parser.js";
import { EmbeddingService } from "../packages/skills/src/material-match/embedding.js";
import { scoreCandidates } from "../packages/skills/src/material-match/scoring.js";
import type { NotionCut, NotionEditBriefRecord } from "../packages/core/src/types/notion.js";

// ─── ENV ───────────────────────────────────────────────
const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const VMS_SUPABASE_URL = process.env.VMS_SUPABASE_URL!;
const VMS_SUPABASE_KEY = process.env.VMS_SUPABASE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SCRIPT_DB_ID = process.env.NOTION_SCRIPT_DB_ID!;
const MASTER_DB_ID = process.env.NOTION_EDIT_BRIEF_MASTER_DB_ID!;
const CUT_DB_ID = process.env.NOTION_EDIT_BRIEF_CUT_DB_ID!;

const TENANT_ID = "e2e-test";
const THRESHOLD = 0.3; // 閾値（低めにして結果を見る）

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   Sprint 1 E2E テスト                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const notion = new NotionSkill(NOTION_API_KEY);
  const embedding = new EmbeddingService(VMS_SUPABASE_URL, VMS_SUPABASE_KEY, GEMINI_API_KEY);

  // ── Step 1: 台本DB から承認済み台本を取得 ──────────────
  console.log("=== Step 1: 台本取得 ===");
  const pages = await notion.queryDatabase({
    databaseId: SCRIPT_DB_ID,
    filter: { property: "ステータス", select: { equals: "承認済" } },
  });

  if (pages.length === 0) {
    console.error("❌ 承認済みの台本が見つかりません");
    process.exit(1);
  }

  const script = mapToNotionScriptRecord(pages[0]);
  const scriptPageId = pages[0].id;
  console.log(`  ✅ 台本取得: "${script.scriptText.slice(0, 40)}..." (${script.charCount || script.scriptText.length}文字)`);

  // ── Step 2: セクション分割 ─────────────────────────────
  console.log("\n=== Step 2: セクション分割 ===");
  const sections = parseScriptIntoSections(script.scriptText);
  console.log(`  ✅ ${sections.length}セクションに分割`);
  for (const s of sections) {
    console.log(`    [${s.section}] ${s.text.slice(0, 50)}...`);
  }

  // ── Step 3: 各セクション × 素材マッチ ──────────────────
  console.log("\n=== Step 3: 素材マッチング (Gemini embedding + VMS) ===");

  const cuts: (NotionCut & { materialScore: number; aiSuggestion: string })[] = [];
  let needsAttention = 0;

  for (const section of sections) {
    // Generate embedding
    const emb = await embedding.generateTextEmbedding(section.text);
    const useVector = emb.length > 0;

    // Search
    const results = await embedding.searchSimilarMaterials({
      queryText: section.text,
      queryEmbedding: useVector ? emb : undefined,
      topK: 3,
      threshold: 0.0,
    });

    const candidates = scoreCandidates(results, section.text);
    const best = candidates[0] ?? null;
    const score = best?.score ?? 0;
    const sufficient = score >= THRESHOLD;

    if (!sufficient) needsAttention++;

    const icon = sufficient ? "✅" : "⚠️";
    const method = useVector ? "vector" : "text";
    console.log(
      `  ${icon} [${section.section}] ${best?.materialName ?? "素材なし"} (score: ${score.toFixed(2)}, ${method})`
    );

    cuts.push({
      section: section.section,
      scriptText: section.text,
      materialId: best?.id,
      materialName: best?.materialName ?? undefined,
      materialUrl: best?.url ?? undefined,
      materialScore: score,
      isAiGenerated: false,
      subtitleText: section.text, // テロップ = 台本テキストそのまま
      aiSuggestion: !sufficient
        ? `[要AI生成] ${section.section}セクションに合う素材がありません (best: ${score.toFixed(2)})`
        : "",
    });
  }

  console.log(`\n  📊 結果: ${cuts.length}カット中 ${needsAttention}件が素材不足`);

  // ── Step 4: 編集概要マスターDB 書き込み ────────────────
  console.log("\n=== Step 4: 編集概要マスターDB 書き込み ===");

  const editBriefRecord: NotionEditBriefRecord & { speaker?: string } = {
    tenantId: TENANT_ID,
    scriptId: scriptPageId,
    cuts,
    totalCharCount: cuts.reduce((sum, c) => sum + (c.scriptText?.length ?? 0), 0),
    status: needsAttention > 0 ? "承認待ち" : "承認待ち",
    speaker: script.interestType ? `${script.interestType}系ナレーター` : "",
  };

  const masterPageId = await notion.createPage({
    databaseId: MASTER_DB_ID,
    properties: buildEditBriefMasterProperties(editBriefRecord),
  });
  console.log(`  ✅ マスターDB作成: ${masterPageId}`);

  // ── Step 5: 編集概要カットDB 書き込み ──────────────────
  console.log("\n=== Step 5: 編集概要カットDB 書き込み ===");

  for (let i = 0; i < cuts.length; i++) {
    const cutProps = buildEditBriefCutProperties(cuts[i], i, masterPageId, TENANT_ID);
    const cutPageId = await notion.createPage({
      databaseId: CUT_DB_ID,
      properties: cutProps,
    });
    console.log(`  ✅ カット ${i + 1}/${cuts.length}: [${cuts[i].section}] → ${cutPageId.slice(0, 8)}...`);

    // Rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  // ── 結果サマリー ──────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   E2E テスト完了                                          ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  台本: ${script.scriptText.slice(0, 30).padEnd(30)}      ║`);
  console.log(`║  カット数: ${String(cuts.length).padEnd(3)} / 素材不足: ${String(needsAttention).padEnd(3)}         ║`);
  console.log(`║  マスターDB: ${masterPageId.slice(0, 20)}...           ║`);
  console.log(`║  Embedding: ${GEMINI_API_KEY ? "Gemini ✅" : "テキスト fallback ⚠️"}                   ║`);
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  Notion URL:                                              ║`);
  console.log(`║  https://notion.so/${masterPageId.replace(/-/g, "")}     ║`);
  console.log("╚════════════════════════════════════════════════════════════╝");
}

main().catch((e) => {
  console.error("❌ E2Eテスト失敗:", e);
  process.exit(1);
});
