/**
 * 編集概要DBをスプレッドシート準拠のカット単位テーブルに再作成
 *
 * スプレッドシート構造:
 * - ヘッダー: 全体文字数, 話者設定/音声, BGM
 * - カラム: 文字数 | テキスト | 修正版依頼 | 注釈 | レギュチェック欄
 *           | 素材名① | 素材①URL | 素材名② | 素材②URL
 *           | テロップ | モーションエフェクト | 効果音 | その他編集指示
 *           | 修正依頼 | 修正② | 修正③
 *
 * Notion構造:
 * - 編集概要マスターDB（1台本=1レコード）: 全体設定
 * - 編集概要カットDB（1カット=1レコード）: カット単位の詳細 ← メインで見るDB
 */
import "dotenv/config";

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const PARENT_PAGE_ID = "32849963-76a2-816b-96e4-d19c3ae40a10"; // 売れるBUZZ AI - DB

async function notionRequest(endpoint: string, method: string, body?: unknown) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion API ${response.status}: ${err}`);
  }
  return response.json();
}

async function createDatabase(title: string, properties: Record<string, unknown>): Promise<string> {
  console.log(`Creating: ${title}...`);
  const result = (await notionRequest("/databases", "POST", {
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: title } }],
    properties,
  })) as { id: string };
  console.log(`  Created: ${result.id}`);
  return result.id;
}

async function main() {
  console.log("=== 編集概要DB 再作成（スプレッドシート準拠） ===\n");

  // 1. 編集概要マスターDB（1台本=1レコード）
  const masterDbId = await createDatabase("編集概要マスターDB", {
    "テナントID": { rich_text: {} },
    "編集概要名": { title: {} },
    "台本ID": { rich_text: {} },
    "全体文字数": { number: { format: "number" } },
    "話者設定": { rich_text: {} },
    "音声ファイル": { rich_text: {} },
    "BGM名": { rich_text: {} },
    "BGM_URL": { url: {} },
    "ステータス": {
      select: {
        options: [
          { name: "作成中" },
          { name: "承認待ち" },
          { name: "承認済" },
          { name: "差し戻し" },
        ],
      },
    },
    "参考/備考": { rich_text: {} },
  });

  await new Promise((r) => setTimeout(r, 400));

  // 2. 編集概要カットDB（1カット=1レコード、メインで確認するDB）
  const cutDbId = await createDatabase("編集概要カットDB", {
    "テナントID": { rich_text: {} },
    "カット名": { title: {} },           // "フック_1" "共感_2" 等
    "編集概要ID": { rich_text: {} },      // マスターDBのページIDで紐付け
    "カット番号": { number: { format: "number" } },

    // === レギュレーション確認担当者様向け ===
    "文字数": { number: { format: "number" } },
    "テキスト": { rich_text: {} },        // 台本テキスト
    "修正版依頼": { rich_text: {} },      // 修正後のテキスト
    "注釈": { rich_text: {} },            // 薬機法等の注釈
    "レギュチェック欄": {
      select: {
        options: [
          { name: "未確認" },
          { name: "OK" },
          { name: "要修正" },
        ],
      },
    },

    // === 素材 ===
    "素材名①": { rich_text: {} },
    "素材①URL": { url: {} },
    "素材名②": { rich_text: {} },
    "素材②URL": { url: {} },

    // === 社内向け（編集指示） ===
    "テロップ": { rich_text: {} },
    "モーションエフェクト": { rich_text: {} },
    "効果音": { rich_text: {} },
    "その他編集指示": { rich_text: {} },

    // === 修正管理 ===
    "修正依頼": { rich_text: {} },
    "修正②": { rich_text: {} },
    "修正③": { rich_text: {} },

    // === AI生成関連 ===
    "素材スコア": { number: { format: "number" } },
    "AI生成提案": { rich_text: {} },
    "AI生成済み": { checkbox: {} },
  });

  console.log("\n=== 作成完了 ===");
  console.log(`\nNOTION_EDIT_BRIEF_MASTER_DB_ID=${masterDbId}`);
  console.log(`NOTION_EDIT_BRIEF_CUT_DB_ID=${cutDbId}`);
  console.log(`\n.envに上記IDを追加してください。`);
}

main().catch(console.error);
