/**
 * 制作テンプレ生成スクリプト v3
 *
 * 1ページに以下を全て含む:
 * - ヘッダー（案件名/担当者/BGM等）+ 一括DL
 * - 🔍 リサーチ
 * - 🎯 訴求開発（カード式 × 5訴求）
 * - 💡 広告企画（カード式 × 5企画）
 * - 📝 台本テーブル（50行フォーマット）
 * - 👤 クライアント共有用トグル
 * - 🎬 編集概要テーブル（40行フォーマット）+ 素材プレビュー
 * - 🎥 完成動画
 * - 📊 クリエイティブレポート
 *
 * Usage: npx tsx scripts/create-production-page.ts
 */
import "dotenv/config";

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID!;
const NOTION_BASE_URL = "https://api.notion.com/v1";

// ─── Notion API helper ───
async function notionRequest(endpoint: string, body: unknown): Promise<any> {
  const res = await fetch(`${NOTION_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API ${res.status}: ${err}`);
  }
  return res.json();
}

async function appendChildren(blockId: string, children: object[]) {
  // Notion API limits to 100 blocks per request
  for (let i = 0; i < children.length; i += 100) {
    const chunk = children.slice(i, i + 100);
    const res = await fetch(`${NOTION_BASE_URL}/blocks/${blockId}/children`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ children: chunk }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion append ${res.status}: ${err}`);
    }
    if (i + 100 < children.length) await sleep(350);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Text helpers ───
function txt(content: string, opts: Record<string, boolean> = {}): object {
  return { type: "text", text: { content }, annotations: { bold: false, italic: false, ...opts } };
}
function boldTxt(content: string): object {
  return { type: "text", text: { content }, annotations: { bold: true } };
}
function colorTxt(content: string, color: string): object {
  return { type: "text", text: { content }, annotations: { color } };
}

// ─── Block helpers ───
function heading2(text: string, color = "default"): object {
  return { type: "heading_2", heading_2: { rich_text: [txt(text)], color } };
}
function heading3(text: string, color = "default"): object {
  return { type: "heading_3", heading_3: { rich_text: [txt(text)], color } };
}
function paragraph(parts: object[]): object {
  return { type: "paragraph", paragraph: { rich_text: parts } };
}
function emptyParagraph(): object {
  return paragraph([txt("")]);
}
function divider(): object {
  return { type: "divider", divider: {} };
}
function callout(emoji: string, text: string, color = "gray_background"): object {
  return {
    type: "callout",
    callout: { icon: { type: "emoji", emoji }, rich_text: [txt(text)], color },
  };
}
function toggle(title: object[], children: object[]): object {
  return {
    type: "toggle",
    toggle: { rich_text: title, color: "default", children },
  };
}

// ─── テーブル生成ヘルパー ───
function tableRow(cells: (string | object[])[]): object {
  return {
    type: "table_row",
    table_row: {
      cells: cells.map((c) => (typeof c === "string" ? [txt(c)] : c)),
    },
  };
}

function emptyRow(colCount: number): object {
  return tableRow(Array(colCount).fill(""));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 1: ヘッダー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildHeader(): object[] {
  return [
    // 案件情報
    {
      type: "column_list",
      column_list: {
        children: [
          { type: "column", column: { children: [
            paragraph([boldTxt("案件名: "), txt("")]),
            paragraph([boldTxt("AP: "), txt(""), boldTxt("  MP: "), txt("")]),
          ]}},
          { type: "column", column: { children: [
            paragraph([boldTxt("CP: "), txt(""), boldTxt("  CD: "), txt("")]),
            paragraph([boldTxt("配信媒体: "), txt("")]),
          ]}},
        ],
      },
    },
    // 音声・BGM
    {
      type: "column_list",
      column_list: {
        children: [
          { type: "column", column: { children: [
            paragraph([boldTxt("話者設定: "), txt("")]),
            paragraph([boldTxt("音声ファイル: "), txt("")]),
          ]}},
          { type: "column", column: { children: [
            paragraph([boldTxt("BGM: "), txt("")]),
            paragraph([boldTxt("全体文字数: "), txt("")]),
          ]}},
        ],
      },
    },
    // 一括DL
    callout("📥", "一括ダウンロード: [Google Driveフォルダリンク]", "blue_background"),
    divider(),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2: リサーチ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildResearch(): object[] {
  // 商品理解テーブル
  const researchRows = [
    // 基本情報
    tableRow([[boldTxt("基本情報")], "", "", "", ""]),
    tableRow(["商品名", "", "商品カテゴリー", "", "前年度売上（億円）"]),
    tableRow(["情報ソース", "", "", "", ""]),
    tableRow(["製品体験メモ", "", "", "", ""]),
    // 機能価値
    tableRow([[colorTxt("機能価値", "red")], "", "", "", ""]),
    tableRow(["機能/成分/サービス", "", "", "", ""]),
    tableRow(["効果効能", "", "", "", ""]),
    tableRow(["研究データ", "", "", "", ""]),
    tableRow(["使用感", "", "", "安全性", ""]),
    // 情緒価値
    tableRow([[colorTxt("情緒価値", "blue")], "", "", "", ""]),
    tableRow(["デザイン", "ベースカラー", "メインカラー", "アクセントカラー", "テキストカラー"]),
    tableRow(["体感", "", "ストーリー", "", "ブランドイメージ"]),
    // 金銭価値
    tableRow([[colorTxt("金銭価値", "green")], "", "", "", ""]),
    tableRow(["通常価格", "", "オファー", "", "限定性"]),
    // 信頼価値
    tableRow([[colorTxt("信頼価値", "purple")], "", "", "", ""]),
    tableRow(["口コミ/レビュー/UGC", "", "", "", ""]),
    tableRow(["受賞歴", "", "", "有名人", ""]),
    tableRow(["売上/企業実績", "", "", "", ""]),
    tableRow(["メディア掲載実績", "", "", "", ""]),
    // 体制価値
    tableRow([[colorTxt("体制価値", "orange")], "", "", "", ""]),
    tableRow(["流通体制", "", "CS体制", "", "販売体制"]),
  ];

  const researchTable = {
    type: "table",
    table: { table_width: 5, has_column_header: false, has_row_header: false, children: researchRows },
  };

  // セグメント分析
  const segmentRows = [
    tableRow([[colorTxt("セグメント分析候補", "blue")], "", "", ""]),
    tableRow(["USP", "", "", ""]),
    tableRow(["機能価値", "", "", ""]),
    tableRow(["提供便益", "", "", ""]),
    tableRow(["便益提供シーン", "", "", ""]),
    tableRow(["便益のない現実", "", "", ""]),
    tableRow(["強いペイン/願望", "", "", ""]),
    tableRow(["想定解決策", "", "", ""]),
    tableRow(["情報/行動障壁", "", "", ""]),
    tableRow(["セグメント分析候補", "", "", ""]),
  ];

  const segmentTable = {
    type: "table",
    table: { table_width: 4, has_column_header: false, has_row_header: false, children: segmentRows },
  };

  // 市場/競合調査
  const marketRows = [
    tableRow([[colorTxt("市場/競合調査", "red")], "", "", ""]),
    tableRow(["", "商品市場", "", "代替市場"]),
    tableRow(["市場名", "", "市場名", ""]),
    tableRow(["市場規模", "", "市場規模", ""]),
    ...Array(5).fill(null).map(() => emptyRow(4)),
  ];

  const marketTable = {
    type: "table",
    table: { table_width: 4, has_column_header: false, has_row_header: false, children: marketRows },
  };

  return [
    heading2("🔍 リサーチ"),
    heading3("商品理解"),
    researchTable,
    emptyParagraph(),
    segmentTable,
    emptyParagraph(),
    marketTable,
    divider(),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 3: 訴求開発（カード式 × 5）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildAppealDev(): object[] {
  // 上部: 訴求カード（横並び5列テーブル）
  const appealCardRows = [
    tableRow(["訴求No.", "1", "2", "3", "4", "5"]),
    tableRow(["訴求名", "", "", "", "", ""]),
    tableRow(["WHO", "", "", "", "", ""]),
    tableRow(["WHAT", "", "", "", "", ""]),
    tableRow(["WHY", "", "", "", "", ""]),
    tableRow(["担当者", "", "", "", "", ""]),
  ];

  const appealCardTable = {
    type: "table",
    table: { table_width: 6, has_column_header: true, has_row_header: true, children: appealCardRows },
  };

  // 下部: 詳細テーブル
  const detailRows = [
    tableRow([[boldTxt("USP")], "訴求仮説", "", "", "", ""]),
    tableRow(["", "機能価値", "", "", "", ""]),
    tableRow([[boldTxt("訴求軸")], "提供便益", "", "", "", ""]),
    tableRow(["", "便益提供シーン", "", "", "", ""]),
    tableRow(["", "便益のない現状", "", "", "", ""]),
    tableRow(["", "強いペイン/願望", "", "", "", ""]),
    tableRow([[boldTxt("WHY")], "欲求ファネル", "", "", "", ""]),
    tableRow(["", "情報/行動障壁", "", "", "", ""]),
    tableRow(["", "想定競合", "", "", "", ""]),
    tableRow([[boldTxt("WHO")], "状態", "", "", "", ""]),
    tableRow(["", "認知", "", "", "", ""]),
    tableRow(["", "制約", "", "", "", ""]),
    tableRow([[boldTxt("WHAT")], "機能価値", "", "", "", ""]),
    tableRow(["", "情緒価値", "", "", "", ""]),
    tableRow(["", "金銭価値", "", "", "", ""]),
    tableRow(["", "信頼価値", "", "", "", ""]),
    tableRow(["", "商品カテゴリー", "", "", "", ""]),
  ];

  const detailTable = {
    type: "table",
    table: { table_width: 6, has_column_header: false, has_row_header: false, children: detailRows },
  };

  return [
    heading2("🎯 訴求開発"),
    appealCardTable,
    emptyParagraph(),
    detailTable,
    divider(),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 4: 広告企画（カード式 × 5）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildPlanDev(): object[] {
  // 企画カード（横並び5列テーブル）
  const planCardRows = [
    tableRow(["訴求No.", "", "", "", "", ""]),
    tableRow(["企画名", "", "", "", "", ""]),
    tableRow(["日付", "", "", "", "", ""]),
    tableRow(["担当者", "", "", "", "", ""]),
    // 前提情報
    tableRow([[colorTxt("前提情報", "blue")], "", "", "", "", ""]),
    tableRow(["広告形式", "", "", "", "", ""]),
    tableRow(["広告種別", "", "", "", "", ""]),
    tableRow(["配信媒体", "", "", "", "", ""]),
    tableRow(["目標指標", "", "", "", "", ""]),
    tableRow(["目標数値", "", "", "", "", ""]),
    tableRow(["遷移先記事URL", "", "", "", "", ""]),
    tableRow(["遷移先LP URL", "", "", "", "", ""]),
    // 広告企画
    tableRow([[colorTxt("広告企画", "green")], "", "", "", "", ""]),
    tableRow(["コンテンツ", "", "", "", "", ""]),
    tableRow(["興味の型", "", "", "", "", ""]),
    tableRow(["構成の型（動画のみ）", "", "", "", "", ""]),
    tableRow(["FV（テキスト）", "", "", "", "", ""]),
    tableRow(["FV（映像）", "", "", "", "", ""]),
    tableRow(["構成", "", "", "", "", ""]),
    // 企画仮説
    tableRow([[colorTxt("企画仮説", "purple")], "", "", "", "", ""]),
    tableRow(["見る理由", "", "", "", "", ""]),
    tableRow(["自分ごと化する理由", "", "", "", "", ""]),
    tableRow(["信じる理由", "", "", "", "", ""]),
    tableRow(["今すぐ行動する理由", "", "", "", "", ""]),
  ];

  const planCardTable = {
    type: "table",
    table: { table_width: 6, has_column_header: false, has_row_header: true, children: planCardRows },
  };

  return [
    heading2("💡 広告企画"),
    planCardTable,
    divider(),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 5: 台本テーブル（50行フォーマット）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildScriptTable(): object[] {
  const SCRIPT_COLS = ["#", "パート", "文字数", "テキスト", "注釈", "レギュ警告", "レギュチェック"];
  const COL_COUNT = SCRIPT_COLS.length;

  const headerRow = tableRow(SCRIPT_COLS);
  const dataRows = Array.from({ length: 50 }, (_, i) =>
    tableRow([String(i + 1), "", "", "", "", "", ""]),
  );

  const scriptTable = {
    type: "table",
    table: { table_width: COL_COUNT, has_column_header: true, has_row_header: false, children: [headerRow, ...dataRows] },
  };

  return [
    heading2("📝 台本"),
    paragraph([txt("※ テキスト入力後、AIが自動でパート分類・文字数計算・レギュ警告を実行します", { italic: true })]),
    scriptTable,
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 6: クライアント共有用トグル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildClientShare(): object[] {
  return [
    toggle(
      [boldTxt("👤 クライアント共有用")],
      [
        callout("📋", "以下の内容をクライアントに共有します: 台本テキスト / 注釈 / レギュレーションチェック欄", "yellow_background"),
        paragraph([txt("※ 台本確定後に自動生成されます")]),
      ],
    ),
    divider(),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 7: 編集概要テーブル（40行） + 素材プレビュー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildEditBriefSection(): object[] {
  const EDIT_COLS = ["#", "テキスト", "注釈", "テロップ", "素材（最大3）", "素材URL", "ME", "SE", "修正依頼"];
  const COL_COUNT = EDIT_COLS.length;

  const headerRow = tableRow(EDIT_COLS);
  const dataRows = Array.from({ length: 40 }, (_, i) =>
    tableRow([String(i + 1), "", "", "", "", "", "", "", ""]),
  );

  const editTable = {
    type: "table",
    table: { table_width: COL_COUNT, has_column_header: true, has_row_header: false, children: [headerRow, ...dataRows] },
  };

  // 素材プレビューセクション
  const previewBlock = toggle(
    [boldTxt("🖼️ 素材プレビュー")],
    [
      paragraph([txt("※ 素材マッチング実行後、使用素材のサムネイルがここに表示されます")]),
      callout("📷", "素材プレビューは自動生成されます（Google Driveサムネイル）", "gray_background"),
    ],
  );

  return [
    heading2("🎬 編集概要"),
    paragraph([txt("※ 台本テーブルのテキスト・注釈は自動で同期されます", { italic: true })]),
    // 素材プレビュー（左） + テーブル を column_list で並べる
    {
      type: "column_list",
      column_list: {
        children: [
          { type: "column", column: { children: [previewBlock] } },
          { type: "column", column: { children: [editTable] } },
        ],
      },
    },
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 8: 完成動画 + クリエイティブレポート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildVideoAndReport(): object[] {
  return [
    divider(),
    heading2("🎥 完成動画"),
    callout("🎬", "完成動画がここに表示されます（動画URL / Driveリンク）", "green_background"),
    emptyParagraph(),
    heading2("📊 クリエイティブレポート"),
    callout("📈", "配信開始後、パフォーマンスレポートがここに表示されます", "purple_background"),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   制作テンプレ v3 生成                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // ── ページ作成（最初にヘッダーだけ） ───
  console.log("=== ページ作成 ===");
  const headerBlocks = buildHeader();

  const pageData = await notionRequest("/pages", {
    parent: { page_id: PARENT_PAGE_ID },
    icon: { type: "emoji", emoji: "🎬" },
    properties: {
      title: { title: [{ text: { content: "制作テンプレ v3" } }] },
    },
    children: headerBlocks,
  });

  const pageId = pageData.id;
  console.log(`  ✅ ページ作成完了: ${pageId}`);

  // ── 各セクションを追加（100ブロック制限対応で分割） ───

  // リサーチ
  console.log("=== リサーチセクション追加 ===");
  await appendChildren(pageId, buildResearch());
  console.log("  ✅ リサーチ完了");
  await sleep(350);

  // 訴求開発
  console.log("=== 訴求開発セクション追加 ===");
  await appendChildren(pageId, buildAppealDev());
  console.log("  ✅ 訴求開発完了");
  await sleep(350);

  // 広告企画
  console.log("=== 広告企画セクション追加 ===");
  await appendChildren(pageId, buildPlanDev());
  console.log("  ✅ 広告企画完了");
  await sleep(350);

  // 台本テーブル (50行 = 51 rows with header, fits in 100 block limit)
  console.log("=== 台本テーブル追加 ===");
  await appendChildren(pageId, buildScriptTable());
  console.log("  ✅ 台本テーブル完了");
  await sleep(350);

  // クライアント共有用
  console.log("=== クライアント共有用追加 ===");
  await appendChildren(pageId, buildClientShare());
  console.log("  ✅ クライアント共有用完了");
  await sleep(350);

  // 編集概要 (40行 = 41 rows)
  console.log("=== 編集概要テーブル追加 ===");
  await appendChildren(pageId, buildEditBriefSection());
  console.log("  ✅ 編集概要テーブル完了");
  await sleep(350);

  // 完成動画 + レポート
  console.log("=== 完成動画・レポート追加 ===");
  await appendChildren(pageId, buildVideoAndReport());
  console.log("  ✅ 完成動画・レポート完了");

  // ── 結果 ───
  const url = `https://notion.so/${pageId.replace(/-/g, "")}`;
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   制作テンプレ v3 完成                                     ║`);
  console.log(`║   ${url}  ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
}

main().catch((e) => {
  console.error("❌ 失敗:", e);
  process.exit(1);
});
