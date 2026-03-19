/**
 * Notion DBテンプレート自動作成スクリプト
 *
 * 実行方法: npx tsx scripts/setup-notion-dbs.ts
 *
 * 前提:
 * - .env に NOTION_API_KEY が設定されている
 * - Notion Integration が対象ページに接続済み
 * - 引数でparent_page_idを指定（DBを作成する親ページ）
 *
 * 使用例:
 *   npx tsx scripts/setup-notion-dbs.ts <parent_page_id>
 */

import "dotenv/config";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) {
  console.error("NOTION_API_KEY is required in .env");
  process.exit(1);
}

const parentPageId = process.argv[2];
if (!parentPageId) {
  console.error("Usage: npx tsx scripts/setup-notion-dbs.ts <parent_page_id>");
  process.exit(1);
}

const NOTION_BASE_URL = "https://api.notion.com/v1";

async function notionRequest(endpoint: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${NOTION_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} ${error}`);
  }

  return response.json();
}

// 共通プロパティ: 全DBにテナントIDを付与
const tenantIdProperty = {
  "テナントID": { rich_text: {} },
};

interface DbDefinition {
  title: string;
  properties: Record<string, unknown>;
}

const databases: DbDefinition[] = [
  {
    title: "案件DB",
    properties: {
      ...tenantIdProperty,
      "案件名": { title: {} },
      "AP担当者": { rich_text: {} },
      "MP担当者": { rich_text: {} },
      "CP担当者": { rich_text: {} },
      "CD担当者": { rich_text: {} },
      "KPI_CPA": { number: { format: "number" } },
      "KPI_CV月": { number: { format: "number" } },
      "月予算": { number: { format: "number" } },
      "配信媒体": { multi_select: { options: [
        { name: "Meta" }, { name: "TikTok" }, { name: "YouTube" },
        { name: "LINE" }, { name: "X" },
      ]}},
      "ステータス": { select: { options: [
        { name: "セットアップ中" }, { name: "稼働中" }, { name: "停止中" },
      ]}},
      "手数料率": { number: { format: "percent" } },
    },
  },
  {
    title: "リサーチDB",
    properties: {
      ...tenantIdProperty,
      "タイトル": { title: {} },
      "案件": { relation: { database_id: "PLACEHOLDER_TENANT_DB" } },
      "カテゴリ": { select: { options: [
        { name: "商品理解" }, { name: "セグメント分析" }, { name: "市場競合" },
        { name: "既存顧客" }, { name: "N1インタビュー" },
      ]}},
      "内容": { rich_text: {} },
      "ソース": { url: {} },
      "ステータス": { select: { options: [
        { name: "未着手" }, { name: "調査中" }, { name: "完了" },
      ]}},
    },
  },
  {
    title: "訴求DB",
    properties: {
      ...tenantIdProperty,
      "訴求名": { title: {} },
      "訴求No": { number: { format: "number" } },
      "WHO": { rich_text: {} },
      "WHAT": { rich_text: {} },
      "WHY": { rich_text: {} },
      "USP": { rich_text: {} },
      "差別化軸": { rich_text: {} },
      "ステータス": { select: { options: [
        { name: "提案中" }, { name: "承認済" }, { name: "不採用" },
      ]}},
    },
  },
  {
    title: "企画DB",
    properties: {
      ...tenantIdProperty,
      "企画名": { title: {} },
      "興味の型": { select: { options: [
        { name: "商品興味" }, { name: "エピソード興味" }, { name: "手法興味" },
        { name: "恐怖興味" }, { name: "未来興味" }, { name: "損失興味" },
        { name: "常識破壊" }, { name: "ターゲット指定" },
      ]}},
      "構成の型": { select: { options: [
        { name: "UGC" }, { name: "アニメ" }, { name: "企業" }, { name: "語り" },
        { name: "店舗体験" }, { name: "ドラマ" }, { name: "バナー動画" },
        { name: "イラスト" }, { name: "インフルエンサー" }, { name: "雑学" }, { name: "AI" },
      ]}},
      "FV（テキスト）": { rich_text: {} },
      "FV（映像）": { rich_text: {} },
      "構成": { rich_text: {} },
      "見る理由": { rich_text: {} },
      "自分ごと化する理由": { rich_text: {} },
      "信じる理由": { rich_text: {} },
      "行動する理由": { rich_text: {} },
      "ステータス": { select: { options: [
        { name: "作成中" }, { name: "承認待ち" }, { name: "承認済" }, { name: "差し戻し" },
      ]}},
    },
  },
  {
    title: "台本DB",
    properties: {
      ...tenantIdProperty,
      "台本名": { title: {} },
      "台本テキスト": { rich_text: {} },
      "企画ID": { rich_text: {} },
      "フックバリエーション": { number: { format: "number" } },
      "フックテキスト": { rich_text: {} },
      "興味の型": { select: { options: [
        { name: "商品興味" }, { name: "エピソード興味" }, { name: "手法興味" },
        { name: "恐怖興味" }, { name: "未来興味" }, { name: "損失興味" },
        { name: "常識破壊" }, { name: "ターゲット指定" },
      ]}},
      "構成の型": { select: { options: [
        { name: "UGC" }, { name: "アニメ" }, { name: "企業" }, { name: "語り" },
        { name: "店舗体験" }, { name: "ドラマ" }, { name: "バナー動画" },
        { name: "イラスト" }, { name: "インフルエンサー" }, { name: "雑学" }, { name: "AI" },
      ]}},
      "文字数": { number: { format: "number" } },
      "注釈": { rich_text: {} },
      "ステータス": { select: { options: [
        { name: "作成中" }, { name: "承認待ち" }, { name: "承認済" }, { name: "差し戻し" },
      ]}},
    },
  },
  {
    title: "編集概要DB",
    properties: {
      ...tenantIdProperty,
      "編集概要名": { title: {} },
      "台本ID": { rich_text: {} },
      "カット情報": { rich_text: {} },
      "BGM": { rich_text: {} },
      "総文字数": { number: { format: "number" } },
      "ステータス": { select: { options: [
        { name: "作成中" }, { name: "承認待ち" }, { name: "承認済" }, { name: "差し戻し" },
      ]}},
    },
  },
  {
    title: "素材ライブラリDB",
    properties: {
      ...tenantIdProperty,
      "素材名": { title: {} },
      "素材形式": { select: { options: [
        { name: "動画" }, { name: "画像" }, { name: "イラスト" }, { name: "音声" },
      ]}},
      "素材ジャンル": { rich_text: {} },
      "素材概要": { rich_text: {} },
      "登場人物": { rich_text: {} },
      "ステータス": { select: { options: [
        { name: "利用可" }, { name: "クライアント提供" }, { name: "利用禁止" }, { name: "AI生成" },
      ]}},
      "URL": { url: {} },
      "Drive File ID": { rich_text: {} },
      "AI生成ソース": { rich_text: {} },
    },
  },
  {
    title: "動画DB",
    properties: {
      ...tenantIdProperty,
      "動画名": { title: {} },
      "動画URL": { url: {} },
      "Google Drive URL": { url: {} },
      "尺（秒）": { number: { format: "number" } },
      "ステータス": { select: { options: [
        { name: "編集中" }, { name: "レンダリング中" }, { name: "承認待ち" },
        { name: "承認済" }, { name: "差し戻し" }, { name: "入稿済" },
      ]}},
    },
  },
  {
    title: "入稿DB",
    properties: {
      ...tenantIdProperty,
      "入稿名": { title: {} },
      "媒体": { select: { options: [
        { name: "Meta" }, { name: "TikTok" }, { name: "YouTube" },
        { name: "LINE" }, { name: "X" },
      ]}},
      "広告ID": { rich_text: {} },
      "クリエイティブID": { rich_text: {} },
      "ステータス": { select: { options: [
        { name: "準備中" }, { name: "入稿済" }, { name: "審査中" },
        { name: "配信中" }, { name: "停止" }, { name: "リジェクト" },
      ]}},
      "入稿日": { date: {} },
    },
  },
  {
    title: "レギュレーションDB",
    properties: {
      ...tenantIdProperty,
      "タイトル": { title: {} },
      "カテゴリ": { select: { options: [
        { name: "薬機法" }, { name: "景表法" }, { name: "媒体規定" }, { name: "クライアント固有" },
      ]}},
      "NG表現": { rich_text: {} },
      "OK代替表現": { rich_text: {} },
      "理由": { rich_text: {} },
      "確認日": { date: {} },
      "担当者": { rich_text: {} },
    },
  },
  {
    title: "承認ログDB",
    properties: {
      ...tenantIdProperty,
      "承認名": { title: {} },
      "フェーズ": { select: { options: [
        { name: "リサーチ" }, { name: "訴求" }, { name: "企画" }, { name: "台本" },
        { name: "編集概要" }, { name: "動画" }, { name: "入稿" }, { name: "運用" },
      ]}},
      "承認ステータス": { select: { options: [
        { name: "承認待ち" }, { name: "承認済" }, { name: "差し戻し" },
      ]}},
      "承認者": { rich_text: {} },
      "コメント": { rich_text: {} },
      "対象ページURL": { url: {} },
      "承認日時": { date: {} },
    },
  },
];

async function createDatabase(db: DbDefinition): Promise<string> {
  console.log(`Creating: ${db.title}...`);

  const result = await notionRequest("/databases", {
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: db.title } }],
    properties: db.properties,
  }) as { id: string };

  console.log(`  Created: ${db.title} (${result.id})`);
  return result.id;
}

async function main(): Promise<void> {
  console.log("=== Notion DB テンプレート作成 ===\n");
  console.log(`Parent Page ID: ${parentPageId}\n`);

  const createdIds: Record<string, string> = {};

  for (const db of databases) {
    // relation先はPLACEHOLDERのまま（後で手動設定 or 2パス作成が必要）
    const filteredProps = Object.fromEntries(
      Object.entries(db.properties).filter(
        ([, v]) => !(v as Record<string, unknown>).relation
          || (v as { relation: { database_id: string } }).relation.database_id !== "PLACEHOLDER_TENANT_DB"
      )
    );
    db.properties = filteredProps;

    try {
      const id = await createDatabase(db);
      createdIds[db.title] = id;
      // Notion rate limit (3 req/sec)
      await new Promise((r) => setTimeout(r, 400));
    } catch (error) {
      console.error(`  Failed: ${db.title}`, error);
    }
  }

  console.log("\n=== 作成完了 ===");
  console.log("\nDB ID一覧（.envに設定してください）:");
  for (const [name, id] of Object.entries(createdIds)) {
    const envKey = `NOTION_${name.replace(/DB$/, "").toUpperCase().replace(/\s/g, "_")}DB_ID`;
    console.log(`${envKey}=${id}`);
  }
}

main().catch(console.error);
