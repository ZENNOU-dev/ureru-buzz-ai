#!/usr/bin/env node
/**
 * 要件定義ギャップ用 GitHub Issue を一括作成する。
 *
 * 推奨: GitHub CLI でログイン済みなら GITHUB_TOKEN 不要
 *   gh auth login
 *   node scripts/create-requirement-gap-issues.mjs
 *
 * または環境変数（値は GitHub が発行したトークンのみ。日本語や説明文を入れない）
 *   export GITHUB_TOKEN=ghp_xxxx   # 半角のみ
 *
 * 必要権限: Issues の Read and write（Fine-grained）または classic の repo
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LABEL = "要件ギャップ";

function isAsciiOnly(s) {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return false;
  }
  return true;
}

function isRunningOnCloudRun() {
  return Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB);
}

function tryTokenFromGhCli() {
  if (isRunningOnCloudRun()) {
    return null;
  }
  try {
    const out = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const t = out.trim();
    if (t && isAsciiOnly(t)) return t;
  } catch {
    // gh not installed or not logged in
  }
  return null;
}

function resolveToken() {
  const raw = process.env.GITHUB_TOKEN?.trim();
  const onCloudRun = isRunningOnCloudRun();

  if (raw) {
    if (!isAsciiOnly(raw)) {
      console.error(`
[エラー] GITHUB_TOKEN に日本語や全角文字が含まれています。
HTTP ヘッダーに使えないため、次のどちらかで進めてください。

【推奨】GitHub CLI（トークンをターミナルに貼らない）
  brew install gh
  gh auth login
  unset GITHUB_TOKEN
  node scripts/create-requirement-gap-issues.mjs

【代替】Classic / Fine-grained PAT をコピーした場合
  export の右辺には「ghp_...」または「github_pat_...」だけを半角で貼る。
  説明文「（Fine-grained なら…）」などは入れない。
`);
      process.exit(1);
    }
    if (raw.length < 10) {
      console.error("[エラー] GITHUB_TOKEN が短すぎます。実際の PAT を設定してください。");
      process.exit(1);
    }
    return {
      token: raw,
      source: onCloudRun ? "GITHUB_TOKEN (e.g. from Secret Manager)" : "GITHUB_TOKEN",
    };
  }

  if (onCloudRun) {
    console.error(`
[エラー] Cloud Run 上で GITHUB_TOKEN が空です。
Job 定義に --set-secrets=GITHUB_TOKEN=<シークレット名>:latest を付け、
実行 SA に roles/secretmanager.secretAccessor を付与してください。
`);
    process.exit(1);
  }

  const fromGh = tryTokenFromGhCli();
  if (fromGh) {
    return { token: fromGh, source: "gh auth token" };
  }

  console.error(`
[エラー] 認証情報がありません。次のいずれかを実行してください。

【推奨】
  brew install gh
  gh auth login
  node scripts/create-requirement-gap-issues.mjs

【代替】PAT を使う（値は英数字・記号のみ）
  export GITHUB_TOKEN=ここにghp_またはgithub_pat_で始まるトークン
  node scripts/create-requirement-gap-issues.mjs
`);
  process.exit(1);
}

const { token, source } = resolveToken();
const repoFull = process.env.GITHUB_REPOSITORY || "ZENNOU-dev/ureru-buzz-ai";

const [owner, repo] = repoFull.split("/");
if (!owner || !repo) {
  console.error("GITHUB_REPOSITORY は owner/repo 形式にしてください。");
  process.exit(1);
}

const jsonPath = path.join(__dirname, "requirement-gap-issues.json");
const definitions = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

async function gh(method, pathname, body) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

console.error(`認証: ${source}（トークン本体は表示しません）`);

await gh("POST", `/repos/${owner}/${repo}/labels`, {
  name: LABEL,
  color: "D93F0B",
  description: "docs/01_requirements.md 対照の未実装（要件ギャップ）",
}).catch((e) => {
  if (!String(e.message).includes("422")) throw e;
});

const existing = await gh(
  "GET",
  `/repos/${owner}/${repo}/issues?state=all&labels=${encodeURIComponent(LABEL)}&per_page=100`,
);
const existingTitles = new Set(existing.map((i) => i.title));

let created = 0;
let skipped = 0;
for (const issue of definitions) {
  if (existingTitles.has(issue.title)) {
    skipped++;
    continue;
  }
  await gh("POST", `/repos/${owner}/${repo}/issues`, {
    title: issue.title,
    body: issue.body,
    labels: [LABEL],
  });
  created++;
  existingTitles.add(issue.title);
}

console.log(`Done. Created: ${created}, skipped (duplicate title): ${skipped}`);
