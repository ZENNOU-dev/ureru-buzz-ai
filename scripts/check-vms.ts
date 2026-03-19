/**
 * VMS Supabase material_vectors テーブルの状態確認スクリプト
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const url = process.env.VMS_SUPABASE_URL;
const key = process.env.VMS_SUPABASE_KEY;

if (!url || !key) {
  console.error("Error: VMS_SUPABASE_URL and VMS_SUPABASE_KEY must be set in .env");
  process.exit(1);
}

console.log("VMS URL:", url);
const client = createClient(url, key);

// 1. Count records
const { count, error: countErr } = await client
  .from("material_vectors")
  .select("*", { count: "exact", head: true });

console.log(`\n=== material_vectors ===`);
console.log(`Total records: ${count ?? "unknown"}`);
if (countErr) console.log("Count error:", countErr.message);

// 2. Sample 3 records
const { data, error } = await client
  .from("material_vectors")
  .select("id, notion_page_id, drive_file_id, content_text, metadata")
  .limit(3);

if (error) {
  console.log("Query error:", error.message);
} else {
  console.log(`\nSample records (${data?.length ?? 0}):`);
  for (const row of data ?? []) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`  Notion Page: ${row.notion_page_id}`);
    console.log(`  Drive File: ${row.drive_file_id}`);
    console.log(`  Content: ${(row.content_text ?? "").slice(0, 120)}...`);
    const meta = JSON.stringify(row.metadata ?? {});
    console.log(`  Metadata: ${meta.slice(0, 200)}`);
  }
}

// 3. Check embedding column dimensions
const { data: embData, error: embErr } = await client
  .from("material_vectors")
  .select("id, embedding")
  .limit(1);

if (embErr) {
  console.log("\nEmbedding check error:", embErr.message);
} else if (embData?.[0]?.embedding) {
  const emb = embData[0].embedding;
  if (Array.isArray(emb)) {
    console.log(`\nEmbedding: array, ${emb.length} dimensions`);
  } else if (typeof emb === "string") {
    // pgvector returns as string sometimes
    const parsed = emb.replace(/[\[\]]/g, "").split(",");
    console.log(`\nEmbedding: string format, ~${parsed.length} dimensions`);
  } else {
    console.log(`\nEmbedding: ${typeof emb}`);
  }
} else {
  console.log("\nNo embedding data found or column empty");
}

// 4. Check distinct projects in metadata
const { data: allData } = await client
  .from("material_vectors")
  .select("metadata")
  .limit(100);

if (allData) {
  const projects = new Set<string>();
  for (const row of allData) {
    const project = (row.metadata as any)?.project;
    if (project) projects.add(project);
  }
  console.log(`\nDistinct projects: ${projects.size > 0 ? [...projects].join(", ") : "none found"}`);
}

// 5. Check RPC function availability
try {
  const { error: rpcErr } = await client.rpc("match_materials", {
    query_embedding: new Array(1536).fill(0),
    match_threshold: 0.0,
    match_count: 1,
    filter_project: null,
  });
  console.log(`\nRPC match_materials: ${rpcErr ? `ERROR: ${rpcErr.message}` : "AVAILABLE"}`);
} catch (e: any) {
  console.log(`\nRPC match_materials: NOT AVAILABLE (${e.message})`);
}

console.log("\n=== Done ===");
