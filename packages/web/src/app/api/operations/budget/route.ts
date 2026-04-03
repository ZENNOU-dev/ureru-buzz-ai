import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

const META_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API = "https://graph.facebook.com/v22.0";

// GET: Fetch budget/bid info for campaign or adset IDs
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);
  const level = req.nextUrl.searchParams.get("level") ?? "campaign";
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!META_TOKEN) return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 503 });
  if (!ids?.length) return NextResponse.json({ error: "ids required" }, { status: 400 });

  try {
    // For adsets: also fetch parent campaign's bid_strategy
    let campaignBidStrategy: string | null = null;
    let campaignDailyBudget: number | null = null;
    if (level === "adset" && campaignId) {
      try {
        const cpnRes = await fetch(`${META_API}/${campaignId}?fields=bid_strategy,daily_budget&access_token=${META_TOKEN}`);
        const cpnData = await cpnRes.json();
        campaignBidStrategy = cpnData.bid_strategy ?? null;
        campaignDailyBudget = cpnData.daily_budget ? Number(cpnData.daily_budget) : null;
      } catch { /* ignore */ }
    }

    const fields = level === "campaign"
      ? "daily_budget,lifetime_budget,bid_strategy,status"
      : "daily_budget,lifetime_budget,bid_amount,status";

    const batchSize = 50;
    const result: Record<string, Record<string, unknown>> = {};

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const items = await Promise.all(
        batch.map(async (id) => {
          try {
            const res = await fetch(`${META_API}/${id}?fields=${fields}&access_token=${META_TOKEN}`);
            return await res.json();
          } catch {
            return { id, error: true };
          }
        })
      );
      for (const item of items) {
        if (item.id) {
          result[item.id] = {
            dailyBudget: item.daily_budget ? Number(item.daily_budget) : (level === "adset" ? campaignDailyBudget : null),
            lifetimeBudget: item.lifetime_budget ? Number(item.lifetime_budget) : null,
            bidStrategy: item.bid_strategy ?? campaignBidStrategy,
            bidAmount: item.bid_amount ? Number(item.bid_amount) : null,
          };
        }
      }
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: Update budget/bid for a campaign or adset
export async function POST(req: NextRequest) {
  if (!META_TOKEN) return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { id, level, name, dailyBudget, bidStrategy, bidAmount } = body as {
      id: string;
      level: string;
      name?: string;
      dailyBudget?: number | null;
      bidStrategy?: string | null;
      bidAmount?: number | null;
    };

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Build update params
    const params = new URLSearchParams({ access_token: META_TOKEN });

    if (dailyBudget !== undefined && dailyBudget !== null) {
      params.set("daily_budget", String(Math.floor(dailyBudget)));
    }
    if (bidStrategy !== undefined && bidStrategy !== null) {
      params.set("bid_strategy", bidStrategy);
    }
    if (bidAmount !== undefined && bidAmount !== null) {
      // bid_amount only for cost_cap; clear if switching to lowest_cost
      if (bidStrategy === "LOWEST_COST_WITHOUT_CAP") {
        // Don't send bid_amount
      } else {
        params.set("bid_amount", String(Math.floor(bidAmount)));
      }
    }

    // Update via Meta API
    const res = await fetch(`${META_API}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();

    const isError = !!data.error;

    // Log to agent_operations
    if (adOrchSupabase) {
      const changes: Record<string, unknown> = {};
      if (dailyBudget !== undefined) changes.daily_budget = dailyBudget;
      if (bidStrategy !== undefined) changes.bid_strategy = bidStrategy;
      if (bidAmount !== undefined) changes.bid_amount = bidAmount;

      await adOrchSupabase.from("agent_operations").insert({
        operation_type: "budget_change",
        target_table: level === "adset" ? "adsets" : "campaigns",
        target_id: id,
        status: isError ? "error" : "success",
        error_message: isError ? data.error.message : null,
        operation_detail: {
          target_name: name ?? null,
          changes,
        },
      });
    }

    if (isError) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
