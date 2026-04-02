import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

type DayAgg = { spend: number; cv: number; mcv: number; impressions: number; clicks: number };

function calcMetrics(d: DayAgg) {
  return {
    cost: d.spend,
    cv: d.cv,
    cpa: d.cv > 0 ? Math.round(d.spend / d.cv) : null,
    cpm: d.impressions > 0 ? Math.round((d.spend / d.impressions) * 1000) : null,
    ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : null,
    cpc: d.clicks > 0 ? Math.round(d.spend / d.clicks) : null,
    mcvr: d.clicks > 0 ? Math.round((d.mcv / d.clicks) * 10000) / 100 : null,
    mcpa: d.mcv > 0 ? Math.round(d.spend / d.mcv) : null,
    lpcvr: d.mcv > 0 ? Math.round((d.cv / d.mcv) * 10000) / 100 : null,
    cvr: d.clicks > 0 ? Math.round((d.cv / d.clicks) * 10000) / 100 : null,
  };
}

function emptyAgg(): DayAgg {
  return { spend: 0, cv: 0, mcv: 0, impressions: 0, clicks: 0 };
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const fromDate = req.nextUrl.searchParams.get("from");
  const toDate = req.nextUrl.searchParams.get("to");
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const adsetId = req.nextUrl.searchParams.get("adsetId");
  const platform = req.nextUrl.searchParams.get("platform") ?? "meta";
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!adOrchSupabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const isSingleDay = fromDate === toDate;

    // For trend: need data before the selected range
    // Single day: selected day + 6 days before (7 days total for sparkline)
    // Range: the range itself for sparkline, plus same-length period before for comparison
    let fetchStart: string;
    let fetchEnd: string;

    if (isSingleDay && fromDate) {
      // 7 days ending on selected day
      fetchStart = new Date(new Date(fromDate).getTime() - 6 * 86400000).toISOString().slice(0, 10);
      fetchEnd = fromDate;
    } else if (fromDate && toDate) {
      // Range + same-length period before for comparison
      const rangeMs = new Date(toDate).getTime() - new Date(fromDate).getTime();
      const rangeDays = Math.round(rangeMs / 86400000) + 1;
      fetchStart = new Date(new Date(fromDate).getTime() - rangeDays * 86400000).toISOString().slice(0, 10);
      fetchEnd = toDate;
    } else {
      // Default: last 7 days
      fetchEnd = new Date().toISOString().slice(0, 10);
      fetchStart = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    }

    const isTiktok = platform === "tiktok";
    const viewName = isTiktok ? "v_tiktok_performance" : "ad_daily_conversions";
    const adsetCol = isTiktok ? "adgroup_id" : "adset_id";

    const rows = await fetchAllRows((rangeFrom, rangeTo) => {
      let q = adOrchSupabase!
        .from(viewName)
        .select("date, spend, cv, mcv, impressions, clicks")
        .eq("project_id", projectId)
        .gte("date", fetchStart)
        .lte("date", fetchEnd);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      if (adsetId) q = q.eq(adsetCol, adsetId);
      return q.range(rangeFrom, rangeTo);
    });

    // Aggregate by date
    const byDate = new Map<string, DayAgg>();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const d = r.date as string;
      const entry = byDate.get(d) ?? emptyAgg();
      entry.spend += Number(r.spend) || 0;
      entry.cv += Number(r.cv) || 0;
      entry.mcv += Number(r.mcv) || 0;
      entry.impressions += Number(r.impressions) || 0;
      entry.clicks += Number(r.clicks) || 0;
      byDate.set(d, entry);
    }

    if (isSingleDay && fromDate) {
      // Single day mode: card = that day, comparison = 7-day avg (6 days before), sparkline = 7 days
      const selectedData = byDate.get(fromDate) ?? emptyAgg();

      const dailyArr: { date: string; agg: DayAgg }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(new Date(fromDate).getTime() - i * 86400000).toISOString().slice(0, 10);
        dailyArr.push({ date: d, agg: byDate.get(d) ?? emptyAgg() });
      }

      // 7-day average (excluding selected day = previous 6 days)
      const prevDays = dailyArr.slice(0, 6);
      const n = prevDays.length;
      const avg: DayAgg = {
        spend: prevDays.reduce((s, d) => s + d.agg.spend, 0) / n,
        cv: prevDays.reduce((s, d) => s + d.agg.cv, 0) / n,
        mcv: prevDays.reduce((s, d) => s + d.agg.mcv, 0) / n,
        impressions: prevDays.reduce((s, d) => s + d.agg.impressions, 0) / n,
        clicks: prevDays.reduce((s, d) => s + d.agg.clicks, 0) / n,
      };

      return NextResponse.json({
        selected: calcMetrics(selectedData),
        comparison: calcMetrics(avg),
        comparisonLabel: "6日平均",
        daily: dailyArr.map((d) => ({ date: d.date.slice(5), ...calcMetrics(d.agg) })),
      });
    } else if (fromDate && toDate) {
      // Range mode: card = range total, comparison = same-length previous period
      const rangeMs = new Date(toDate).getTime() - new Date(fromDate).getTime();
      const rangeDays = Math.round(rangeMs / 86400000) + 1;

      // Selected range aggregation
      const selectedTotal = emptyAgg();
      const dailyArr: { date: string; agg: DayAgg }[] = [];
      for (let i = 0; i < rangeDays; i++) {
        const d = new Date(new Date(fromDate).getTime() + i * 86400000).toISOString().slice(0, 10);
        const agg = byDate.get(d) ?? emptyAgg();
        selectedTotal.spend += agg.spend;
        selectedTotal.cv += agg.cv;
        selectedTotal.mcv += agg.mcv;
        selectedTotal.impressions += agg.impressions;
        selectedTotal.clicks += agg.clicks;
        dailyArr.push({ date: d, agg });
      }

      // Previous period aggregation (same length before fromDate)
      const prevTotal = emptyAgg();
      for (let i = 1; i <= rangeDays; i++) {
        const d = new Date(new Date(fromDate).getTime() - i * 86400000).toISOString().slice(0, 10);
        const agg = byDate.get(d) ?? emptyAgg();
        prevTotal.spend += agg.spend;
        prevTotal.cv += agg.cv;
        prevTotal.mcv += agg.mcv;
        prevTotal.impressions += agg.impressions;
        prevTotal.clicks += agg.clicks;
      }

      return NextResponse.json({
        selected: calcMetrics(selectedTotal),
        comparison: calcMetrics(prevTotal),
        comparisonLabel: "前期間",
        daily: dailyArr.map((d) => ({ date: d.date.slice(5), ...calcMetrics(d.agg) })),
      });
    }

    // Fallback
    return NextResponse.json({ selected: calcMetrics(emptyAgg()), comparison: calcMetrics(emptyAgg()), comparisonLabel: "-", daily: [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
