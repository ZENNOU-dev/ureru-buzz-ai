import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");

  // Fetch both log sources in parallel
  const [fetchLogs, opLogs] = await Promise.all([
    adOrchSupabase
      .from("fetch_log")
      .select("id, started_at, finished_at, status, rows_fetched, error_message")
      .order("id", { ascending: false })
      .limit(limit),
    adOrchSupabase
      .from("agent_operations")
      .select("id, created_at, operation_type, target_table, target_id, status, error_message, operation_detail")
      .order("id", { ascending: false })
      .limit(limit),
  ]);

  // Normalize into unified log entries
  const logs: {
    id: string;
    timestamp: string;
    type: string;
    target: string;
    detail: string;
    status: "success" | "error";
    error?: string;
  }[] = [];

  for (const r of fetchLogs.data ?? []) {
    logs.push({
      id: `fetch-${r.id}`,
      timestamp: r.started_at,
      type: "データ同期",
      target: "Meta Ads",
      detail: `${r.rows_fetched}行取得`,
      status: r.status === "success" ? "success" : "error",
      error: r.error_message ?? undefined,
    });
  }

  for (const r of opLogs.data ?? []) {
    const detail = r.operation_detail as Record<string, unknown> | null;
    const targetName = detail?.target_name as string ?? r.target_id;
    let typeLabel = r.operation_type;
    let detailLabel = "";

    if (r.operation_type === "status_change") {
      typeLabel = "ステータス変更";
      detailLabel = `→ ${detail?.requested_status ?? "?"}（実効: ${detail?.effective_status ?? "?"}）`;
    } else if (r.operation_type === "submission") {
      typeLabel = "入稿";
    } else if (r.operation_type === "budget_change") {
      typeLabel = "予算変更";
    }

    const tableLabel = r.target_table === "campaigns" ? "キャンペーン" :
      r.target_table === "adsets" ? "広告セット" :
      r.target_table === "ads" ? "広告" : r.target_table;

    logs.push({
      id: `op-${r.id}`,
      timestamp: r.created_at,
      type: typeLabel,
      target: `${tableLabel}: ${targetName}`,
      detail: detailLabel,
      status: r.status === "success" ? "success" : "error",
      error: r.error_message ?? undefined,
    });
  }

  // Sort by timestamp descending
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return NextResponse.json(logs.slice(0, limit));
}
