import { NextRequest, NextResponse } from "next/server";
import { adOrchSupabase, fetchAllRows } from "@/lib/ad-orch-supabase";

export const dynamic = "force-dynamic";

function aggregate(rows: Record<string, unknown>[]) {
  let spend = 0, cv = 0, impressions = 0, clicks = 0;
  for (const r of rows) {
    spend += Number(r.spend) || 0;
    cv += Number(r.cv) || 0;
    impressions += Number(r.impressions) || 0;
    clicks += Number(r.clicks) || 0;
  }
  return { spend, cv, impressions, clicks };
}

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!adOrchSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // --- Monthly KPI ---
  let monthStart: string, monthEnd: string, prevMonthStart: string, prevMonthEnd: string;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    monthStart = `${month}-01`;
    monthEnd = new Date(y, m, 0).toISOString().slice(0, 10); // last day
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    prevMonthStart = `${py}-${String(pm).padStart(2, "0")}-01`;
    prevMonthEnd = new Date(py, pm, 0).toISOString().slice(0, 10);
  } else {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    monthEnd = now.toISOString().slice(0, 10);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    prevMonthStart = `${py}-${String(pm).padStart(2, "0")}-01`;
    prevMonthEnd = new Date(py, pm, 0).toISOString().slice(0, 10);
  }

  // --- Weekly KPI (last 7 days) ---
  const today = new Date();
  const weekEnd = today.toISOString().slice(0, 10);
  const weekStart = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const prevWeekEnd = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const prevWeekStart = new Date(today.getTime() - 13 * 86400000).toISOString().slice(0, 10);

  const q = (fields: string, start: string, end: string) =>
    fetchAllRows((from, to) =>
      adOrchSupabase!.from("ad_daily_conversions").select(fields)
        .eq("project_id", projectId).gte("date", start).lte("date", end)
        .range(from, to)
    );

  let monthCurData, monthPrevData, weekCurData, weekPrevData, dailyData;
  try {
    [monthCurData, monthPrevData, weekCurData, weekPrevData, dailyData] = await Promise.all([
      q("spend, cv, impressions, clicks", monthStart, monthEnd),
      q("spend, cv, impressions, clicks", prevMonthStart, prevMonthEnd),
      q("spend, cv, impressions, clicks", weekStart, weekEnd),
      q("spend, cv, impressions, clicks", prevWeekStart, prevWeekEnd),
      q("date, spend, cv, impressions, clicks", monthStart, monthEnd),
    ]);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  function buildKpi(curRows: unknown[], prevRows: unknown[]) {
    const c = aggregate(curRows as Record<string, unknown>[]);
    const p = aggregate(prevRows as Record<string, unknown>[]);
    const cpa = c.cv > 0 ? Math.round(c.spend / c.cv) : 0;
    const prevCpa = p.cv > 0 ? Math.round(p.spend / p.cv) : 0;
    const ctr = c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0;
    const prevCtr = p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 100 : 0;
    return {
      cv: c.cv, spend: c.spend, cpa, ctr,
      cvChange: pctChange(c.cv, p.cv),
      spendChange: pctChange(c.spend, p.spend),
      cpaChange: pctChange(cpa, prevCpa),
      ctrChange: pctChange(ctr, prevCtr),
    };
  }

  // --- Daily chart data ---
  const dailyMap = new Map<string, { cv: number; spend: number }>();
  for (const r of dailyData) {
    const row = r as Record<string, unknown>;
    const d = row.date as string;
    const entry = dailyMap.get(d) ?? { cv: 0, spend: 0 };
    entry.cv += Number(row.cv) || 0;
    entry.spend += Number(row.spend) || 0;
    dailyMap.set(d, entry);
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date: date.slice(5), cv: v.cv, spend: Math.round(v.spend) }));

  return NextResponse.json({
    monthly: buildKpi(monthCurData, monthPrevData),
    weekly: buildKpi(weekCurData, weekPrevData),
    daily,
  });
}
