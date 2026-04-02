import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";
import { resolveCreativeName } from "@/lib/extract-creative-name";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const adsetId = req.nextUrl.searchParams.get("adsetId");
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const fromDate = req.nextUrl.searchParams.get("from");
  const toDate = req.nextUrl.searchParams.get("to");
  const platform = req.nextUrl.searchParams.get("platform") ?? "meta";

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!adOrchSupabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const isTiktok = platform === "tiktok";
    const viewName = isTiktok ? "v_tiktok_performance" : "ad_daily_conversions";
    const adsetCol = isTiktok ? "adgroup_id" : "adset_id";

    const rows = await fetchAllRows((rangeFrom, rangeTo) => {
      let q = adOrchSupabase!
        .from(viewName)
        .select("date, ad_name, creative_name, spend, cv")
        .eq("project_id", projectId);
      if (adsetId) q = q.eq(adsetCol, adsetId);
      else if (campaignId) q = q.eq("campaign_id", campaignId);
      if (fromDate) q = q.gte("date", fromDate);
      if (toDate) q = q.lte("date", toDate);
      return q.range(rangeFrom, rangeTo);
    });

    // date × cr → { cost, cv }
    interface DayCr { cost: number; cv: number }
    const dateMap = new Map<string, Map<string, DayCr>>();
    const allCreatives = new Set<string>();
    const crSummary = new Map<string, { cost: number; cv: number }>();

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const date = r.date as string;
      const crName = resolveCreativeName(r) ?? "不明";
      const cost = Number(r.spend) || 0;
      const cv = Number(r.cv) || 0;

      allCreatives.add(crName);

      if (!dateMap.has(date)) dateMap.set(date, new Map());
      const dayMap = dateMap.get(date)!;
      const dayCr = dayMap.get(crName) ?? { cost: 0, cv: 0 };
      dayCr.cost += cost;
      dayCr.cv += cv;
      dayMap.set(crName, dayCr);

      const entry = crSummary.get(crName) ?? { cost: 0, cv: 0 };
      entry.cost += cost;
      entry.cv += cv;
      crSummary.set(crName, entry);
    }

    const dates = Array.from(dateMap.keys()).sort();

    // Daily data: share%, cost, cv per CR
    const daily = dates.map((date) => {
      const dayMap = dateMap.get(date)!;
      const totalCost = Array.from(dayMap.values()).reduce((s, v) => s + v.cost, 0);
      const entry: Record<string, unknown> = { date: date.slice(5), _totalCost: Math.round(totalCost) };

      for (const cr of allCreatives) {
        const d = dayMap.get(cr);
        const cost = d?.cost ?? 0;
        const cv = d?.cv ?? 0;
        // Share as integer-ish percent (avoid >100 from rounding)
        const rawShare = totalCost > 0 ? (cost / totalCost) * 100 : 0;
        entry[cr] = Math.round(rawShare * 10) / 10;
        entry[`${cr}__cost`] = Math.round(cost);
        entry[`${cr}__cv`] = cv;
      }

      // Normalize shares to exactly 100%
      const shares = Array.from(allCreatives).map((cr) => ({ cr, share: entry[cr] as number }));
      const sumShares = shares.reduce((s, x) => s + x.share, 0);
      if (sumShares > 0 && Math.abs(sumShares - 100) > 0.01) {
        const diff = 100 - sumShares;
        const largest = shares.sort((a, b) => b.share - a.share)[0];
        entry[largest.cr] = Math.round((largest.share + diff) * 10) / 10;
      }

      return entry;
    });

    // CR list with summary
    const creatives = Array.from(crSummary.entries())
      .map(([name, { cost, cv }]) => ({
        name,
        cost: Math.round(cost),
        cv,
        cpa: cv > 0 ? Math.round(cost / cv) : null,
      }))
      .sort((a, b) => b.cost - a.cost);

    return NextResponse.json({ daily, creatives });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
