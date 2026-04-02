import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

const META_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API = "https://graph.facebook.com/v22.0";

// GET: Fetch statuses for a list of IDs
export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get("level");
  const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);
  if (!META_TOKEN) return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 503 });
  if (!level || !ids?.length) return NextResponse.json({ error: "level and ids required" }, { status: 400 });

  try {
    const batchSize = 50;
    const statusMap: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            const res = await fetch(`${META_API}/${id}?fields=status,effective_status&access_token=${META_TOKEN}`);
            const data = await res.json();
            return { id, status: data.effective_status ?? data.status ?? "UNKNOWN" };
          } catch {
            return { id, status: "UNKNOWN" };
          }
        })
      );
      for (const r of results) statusMap[r.id] = r.status;
    }
    return NextResponse.json(statusMap);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: Update status + log to agent_operations
export async function POST(req: NextRequest) {
  if (!META_TOKEN) return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { id, status, level, name } = body as { id: string; status: string; level?: string; name?: string };
    if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
    if (!["ACTIVE", "PAUSED"].includes(status)) {
      return NextResponse.json({ error: "status must be ACTIVE or PAUSED" }, { status: 400 });
    }

    // 1. Update status via Meta API
    const res = await fetch(`${META_API}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `status=${status}&access_token=${META_TOKEN}`,
    });
    const data = await res.json();

    const isError = !!data.error;

    // 2. Verify (wait 2s for Meta to propagate)
    let effectiveStatus = "UNKNOWN";
    if (!isError) {
      await new Promise((r) => setTimeout(r, 2000));
      const verifyRes = await fetch(`${META_API}/${id}?fields=status,effective_status&access_token=${META_TOKEN}`);
      const verified = await verifyRes.json();
      effectiveStatus = verified.effective_status ?? verified.status ?? "UNKNOWN";
    }

    // 3. Log to agent_operations
    if (adOrchSupabase) {
      await adOrchSupabase.from("agent_operations").insert({
        operation_type: "status_change",
        target_table: level === "ad" ? "ads" : level === "adset" ? "adsets" : "campaigns",
        target_id: id,
        status: isError ? "error" : "success",
        error_message: isError ? data.error.message : null,
        operation_detail: {
          requested_status: status,
          effective_status: effectiveStatus,
          target_name: name ?? null,
        },
      });
    }

    if (isError) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      id,
      requestedStatus: status,
      effectiveStatus,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
