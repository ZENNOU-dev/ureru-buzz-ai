/**
 * 台本DBにサンプル台本を投入するスクリプト
 *
 * 実行: pnpm exec tsx scripts/seed-sample-script.ts
 */
import "dotenv/config";

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const SCRIPT_DB_ID = process.env.NOTION_SCRIPT_DB_ID!;

if (!NOTION_API_KEY || !SCRIPT_DB_ID) {
  console.error("NOTION_API_KEY and NOTION_SCRIPT_DB_ID must be set in .env");
  process.exit(1);
}

const SAMPLE_TENANT_ID = "11111111-1111-1111-1111-111111111111";

const SAMPLE_SCRIPT = `[フック]あなたの借金、実は減らせるかもしれません。毎月の返済で首が回らない…そんな悩みを抱えていませんか？

[共感]毎月届くカードの請求書を見るたびに胃が痛くなる。給料日が来てもすぐに返済に消えていく。友人の誘いも断り続ける日々。「もう自分だけではどうにもならない」そう感じているのは、あなただけではありません。

[コンセプト]実は、法律で認められた「債務整理」という方法で、借金を大幅に減額できる可能性があります。多くの方が知らないだけで、国が認めた正当な解決策なのです。

[商品紹介]債務整理専門の弁護士事務所では、あなたの借金状況を無料で診断。過払い金の有無、任意整理・個人再生・自己破産、あなたに最適な方法をプロが提案します。相談実績は年間10,000件以上。

[ベネフィット]実際に債務整理を行った方の声です。「月々の返済が12万円から3万円に減りました」「督促の電話が止まって、夜眠れるようになりました」「2年で完済して、今は貯金もできています」

[オファー]今なら無料相談を実施中。LINEで簡単に相談できます。秘密厳守・全国対応。まずは「いくら減額できるか」だけでも確認してみませんか？

[CTA]プロフィールのリンクから無料診断へ。たった30秒で、あなたの借金がいくら減るかわかります。`;

async function main() {
  console.log("=== サンプル台本投入 ===\n");
  console.log(`台本DB: ${SCRIPT_DB_ID}`);
  console.log(`テナントID: ${SAMPLE_TENANT_ID}\n`);

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: SCRIPT_DB_ID },
      properties: {
        "台本名": {
          title: [{ text: { content: "【債務整理】借金減額訴求_UGC_フック1" } }],
        },
        "テナントID": {
          rich_text: [{ text: { content: SAMPLE_TENANT_ID } }],
        },
        "台本テキスト": {
          rich_text: [{ text: { content: SAMPLE_SCRIPT } }],
        },
        "企画ID": {
          rich_text: [{ text: { content: "plan-sample-001" } }],
        },
        "フックバリエーション": {
          number: 1,
        },
        "フックテキスト": {
          rich_text: [{ text: { content: "あなたの借金、実は減らせるかもしれません。" } }],
        },
        "興味の型": {
          select: { name: "恐怖興味" },
        },
        "構成の型": {
          select: { name: "UGC" },
        },
        "文字数": {
          number: SAMPLE_SCRIPT.replace(/\[.*?\]/g, "").length,
        },
        "ステータス": {
          select: { name: "承認済" },
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Error:", response.status, err);
    process.exit(1);
  }

  const data = (await response.json()) as { id: string; url: string };
  console.log("✅ サンプル台本を投入しました");
  console.log(`  Page ID: ${data.id}`);
  console.log(`  URL: ${data.url}`);
  console.log(`\nこのPage IDをE2Eテストで使用します。`);
}

main().catch(console.error);
