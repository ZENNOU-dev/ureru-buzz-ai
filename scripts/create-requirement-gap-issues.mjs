#!/usr/bin/env node
/**
 * 要件定義ギャップ用 GitHub Issue を一括作成する。
 * 使用例:
 *   GITHUB_TOKEN=ghp_xxx node scripts/create-requirement-gap-issues.mjs
 *   GITHUB_REPOSITORY=owner/repo node scripts/create-requirement-gap-issues.mjs
 *
 * 必要権限: repo の Issues 書き込み
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LABEL = "要件ギャップ";

const token = process.env.GITHUB_TOKEN;
const repoFull = process.env.GITHUB_REPOSITORY || "ZENNOU-dev/ureru-buzz-ai";

if (!token) {
  console.error("GITHUB_TOKEN が未設定です（Fine-grained なら Issues: Read and write）。");
  process.exit(1);
}

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
