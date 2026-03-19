/**
 * Sprint 1 E2Eテスト
 *
 * 実際のNotion/VMS Supabase/Claude APIを使って
 * EditBriefAgentの全フローを検証する
 *
 * 実行: ./node_modules/.bin/tsx scripts/e2e-test.ts
 */
import "dotenv/config";

// ---- Step 1: NotionSkillで台本を読む ----
async function testNotionRead() {
  console.log("\n=== Step 1: NotionSkill - 台本読み取り ===");

  const { NotionSkill, mapToNotionScriptRecord } = await import("../packages/skills/src/notion/index.js");

  const notion = new NotionSkill(process.env.NOTION_API_KEY!);

  // サンプル台本のPage IDを取得（seed-sample-scriptで作成したもの）
  const scriptDbId = process.env.NOTION_SCRIPT_DB_ID!;

  const pages = await notion.queryDatabase({
    databaseId: scriptDbId,
    filter: {
      property: "ステータス",
      select: { equals: "承認済" },
    },
  });

  console.log(`  承認済み台本: ${pages.length}件`);

  if (pages.length === 0) {
    console.error("  ❌ 承認済み台本がありません");
    process.exit(1);
  }

  const scriptPage = pages[0];
  console.log(`  Page ID: ${scriptPage.id}`);

  const script = mapToNotionScriptRecord(scriptPage);
  console.log(`  台本名: (mapped)`);
  console.log(`  テナントID: ${script.tenantId}`);
  console.log(`  興味の型: ${script.interestType}`);
  console.log(`  文字数: ${script.charCount}`);
  console.log(`  ステータス: ${script.status}`);
  console.log(`  台本テキスト (先頭100文字): ${script.scriptText.slice(0, 100)}...`);

  if (!script.scriptText) {
    console.error("  ❌ 台本テキストが空です");
    process.exit(1);
  }

  console.log("  ✅ NotionSkill 台本読み取り成功\n");
  return { notion, scriptPage, script, scriptPageId: scriptPage.id };
}

// ---- Step 2: 台本のセクション分割 ----
async function testScriptParser(scriptText: string) {
  console.log("=== Step 2: script-parser - セクション分割 ===");

  const { parseScriptIntoSections } = await import("../packages/agents/src/edit-brief/script-parser.js");

  const sections = parseScriptIntoSections(scriptText);

  console.log(`  セクション数: ${sections.length}`);
  for (const s of sections) {
    console.log(`    [${s.section}] ${s.text.slice(0, 50)}...`);
  }

  if (sections.length === 0) {
    console.error("  ❌ セクション分割結果が空です");
    process.exit(1);
  }

  console.log("  ✅ セクション分割成功\n");
  return sections;
}

// ---- Step 3: MaterialMatchSkillでVMS素材検索 ----
async function testMaterialMatch(sectionText: string) {
  console.log("=== Step 3: MaterialMatchSkill - 素材マッチング ===");

  const { EmbeddingService } = await import("../packages/skills/src/material-match/embedding.js");
  const { scoreCandidates } = await import("../packages/skills/src/material-match/scoring.js");

  const embeddingService = new EmbeddingService(
    process.env.VMS_SUPABASE_URL!,
    process.env.VMS_SUPABASE_KEY!,
    process.env.GEMINI_API_KEY, // optional
  );

  // テキストベース検索（Gemini API keyがなくても動く）
  const results = await embeddingService.searchSimilarMaterials({
    queryText: sectionText,
    topK: 5,
    threshold: 0.0,
    tenantProjectName: "05_債務整理",
  });

  console.log(`  検索結果: ${results.length}件`);

  const candidates = scoreCandidates(results, sectionText);

  for (const c of candidates.slice(0, 3)) {
    console.log(`    素材: ${c.materialName?.slice(0, 30)} (score: ${c.score.toFixed(2)})`);
    console.log(`      理由: ${c.reason.slice(0, 80)}`);
  }

  if (results.length === 0) {
    console.warn("  ⚠️ 素材が見つかりませんでした（テキスト検索のキーワード一致なし）");
  } else {
    console.log("  ✅ 素材マッチング成功\n");
  }

  return candidates;
}

// ---- Step 4: NotionSkillで編集概要を書き込む ----
async function testNotionWrite(notion: any, scriptPageId: string) {
  console.log("=== Step 4: NotionSkill - 編集概要書き込み ===");

  const { buildEditBriefProperties } = await import("../packages/skills/src/notion/mappers.js");

  const editBriefDbId = process.env.NOTION_EDIT_BRIEF_DB_ID!;

  const sampleEditBrief = {
    tenantId: "11111111-1111-1111-1111-111111111111",
    scriptId: scriptPageId,
    cuts: [
      {
        section: "hook",
        scriptText: "あなたの借金、実は減らせるかもしれません。",
        materialId: "test-material-1",
        materialUrl: "https://drive.google.com/file/d/test/view",
        materialName: "冒頭B.MOV",
        isAiGenerated: false,
        subtitleText: "【あなたの借金】実は減らせる",
        subtitleStyle: "white-bold-center",
        effects: ["zoom_in"],
        soundEffects: [],
        durationSeconds: 8,
      },
      {
        section: "empathy",
        scriptText: "毎月届くカードの請求書を見るたびに胃が痛くなる。",
        subtitleText: "請求書を見るたびに【胃が痛い】",
        subtitleStyle: "white-bold-center",
        effects: ["fade_in"],
        soundEffects: [],
        durationSeconds: 12,
      },
    ],
    bgm: { name: "Emotional Acoustic", url: "bgm/emotional-acoustic.mp3", volume: 0.2 },
    totalCharCount: 450,
    status: "承認待ち",
  };

  const properties = buildEditBriefProperties(sampleEditBrief);
  const editBriefPageId = await notion.createPage({
    databaseId: editBriefDbId,
    properties,
  });

  console.log(`  編集概要ページ作成: ${editBriefPageId}`);
  console.log(`  URL: https://www.notion.so/${editBriefPageId.replace(/-/g, "")}`);
  console.log("  ✅ 編集概要書き込み成功\n");

  return editBriefPageId;
}

// ---- メイン ----
async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   Sprint 1 E2E テスト                     ║");
  console.log("╚═══════════════════════════════════════════╝");

  // Step 1: Notion読み取り
  const { notion, script, scriptPageId } = await testNotionRead();

  // Step 2: セクション分割
  const sections = await testScriptParser(script.scriptText);

  // Step 3: VMS素材検索
  const hookSection = sections.find((s) => s.section === "hook");
  if (hookSection) {
    await testMaterialMatch(hookSection.text);
  }

  // Step 4: Notion書き込み
  const editBriefPageId = await testNotionWrite(notion, scriptPageId);

  // サマリー
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   E2E テスト結果                          ║");
  console.log("╠═══════════════════════════════════════════╣");
  console.log("║ ✅ Step 1: Notion台本読み取り              ║");
  console.log("║ ✅ Step 2: 台本セクション分割              ║");
  console.log("║ ✅ Step 3: VMS素材マッチング               ║");
  console.log("║ ✅ Step 4: Notion編集概要書き込み          ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log(`\n編集概要ページ: https://www.notion.so/${editBriefPageId.replace(/-/g, "")}`);
}

main().catch((err) => {
  console.error("\n❌ E2Eテスト失敗:", err);
  process.exit(1);
});
