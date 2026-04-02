"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, Play, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { useProject } from "@/components/providers/project-provider";
import { VideoPreviewModal } from "@/components/video-preview-modal";

type Platform = "meta" | "tiktok";
type Level = "campaign" | "adset" | "ad";
type SortDir = "asc" | "desc";

interface Row {
  id: string;
  name: string;
  campaignName?: string;
  adsetName?: string;
  creativeName?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  cost: number;
  cv: number;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
  mcvr: number | null;
  mcpa: number | null;
  lpcvr: number | null;
  cvr: number | null;
}

function fmt(v: number | null, prefix = "", suffix = ""): string {
  if (v === null || v === undefined) return "-";
  return `${prefix}${v.toLocaleString()}${suffix}`;
}

interface KpiData {
  selected: Record<string, number | null>;
  comparison: Record<string, number | null>;
  comparisonLabel: string;
  daily: Record<string, unknown>[];
}

const KPI_DEFS = [
  { key: "cost", label: "COST", prefix: "¥", suffix: "", lowerBetter: true },
  { key: "cv", label: "CV", prefix: "", suffix: "", lowerBetter: false },
  { key: "cpa", label: "CPA", prefix: "¥", suffix: "", lowerBetter: true },
  { key: "cpm", label: "CPM", prefix: "¥", suffix: "", lowerBetter: true },
  { key: "ctr", label: "CTR", prefix: "", suffix: "%", lowerBetter: false },
  { key: "cpc", label: "CPC", prefix: "¥", suffix: "", lowerBetter: true },
  { key: "mcvr", label: "MCVR", prefix: "", suffix: "%", lowerBetter: false },
  { key: "mcpa", label: "MCPA", prefix: "¥", suffix: "", lowerBetter: true },
  { key: "lpcvr", label: "LPCVR", prefix: "", suffix: "%", lowerBetter: false },
  { key: "cvr", label: "CVR", prefix: "", suffix: "%", lowerBetter: false },
] as const;

const GRADIENT_COLORS = [
  "from-[#FF6B9D] to-[#C084FC]",
  "from-[#9333EA] to-[#6366F1]",
  "from-[#22D3EE] to-[#6366F1]",
  "from-[#D4A574] to-[#E8C98A]",
  "from-[#34D399] to-[#22D3EE]",
  "from-[#FF8A65] to-[#FF6B9D]",
  "from-[#6366F1] to-[#9333EA]",
  "from-[#22D3EE] to-[#34D399]",
  "from-[#C084FC] to-[#FF6B9D]",
  "from-[#34D399] to-[#6366F1]",
];

function KpiCard({ def, selectedVal, comparisonVal, comparisonLabel, daily, gradient }: {
  def: typeof KPI_DEFS[number];
  selectedVal: number | null;
  comparisonVal: number | null;
  comparisonLabel: string;
  daily: { date: string; value: number | null }[];
  gradient: string;
}) {
  const deviation = selectedVal !== null && comparisonVal !== null && comparisonVal !== 0
    ? Math.round(((selectedVal - comparisonVal) / comparisonVal) * 1000) / 10
    : null;
  const isGood = deviation !== null
    ? def.lowerBetter ? deviation <= 0 : deviation >= 0
    : true;

  const sparkData = daily.map((d) => ({ date: d.date, v: d.value ?? 0 }));
  const firstDate = daily[0]?.date ?? "";
  const lastDate = daily[daily.length - 1]?.date ?? "";
  const avgValue = sparkData.length > 0 ? sparkData.reduce((s, d) => s + d.v, 0) / sparkData.length : 0;
  const fmtShort = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  };

  return (
    <div className="content-card rounded-xl p-3.5 relative overflow-hidden min-w-0">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${gradient}`} />
      <p className="text-[11px] text-[#1A1A2E]/40 font-medium">{def.label}</p>
      <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">
        {selectedVal !== null ? `${def.prefix}${selectedVal.toLocaleString()}${def.suffix}` : "-"}
      </p>
      <div className="flex items-center gap-1 mt-1">
        {deviation !== null ? (
          <>
            {isGood ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
            <span className={`text-[10px] font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
              {deviation > 0 ? "+" : ""}{deviation}%
            </span>
            <span className="text-[10px] text-[#1A1A2E]/25">vs {comparisonLabel}</span>
          </>
        ) : (
          <span className="text-[10px] text-[#1A1A2E]/25">—</span>
        )}
      </div>
      {sparkData.length > 0 && (
        <div className="mt-1.5">
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={sparkData} margin={{ left: 30, right: 4, top: 2, bottom: 2 }}>
                <YAxis
                  domain={[0, "auto"]}
                  ticks={avgValue > 0 ? [0, Math.round(avgValue * 100) / 100] : [0]}
                  tick={{ fontSize: 8, fill: "#999" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  tickFormatter={(v: number) => `${def.prefix}${fmtShort(v)}${def.suffix}`}
                />
                <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
                <ReferenceLine y={avgValue} stroke="#9333EA" strokeDasharray="4 3" strokeWidth={1.2} label={{ value: "avg", position: "right", fontSize: 8, fill: "#9333EA", fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #eee", fontSize: 10, padding: "4px 8px" }}
                  formatter={(value: number) => [`${def.prefix}${value.toLocaleString()}${def.suffix}`, def.label]}
                  labelFormatter={(_: unknown, payload: unknown[]) => {
                    const p = payload?.[0] as { payload?: { date?: string } } | undefined;
                    return p?.payload?.date ?? "";
                  }}
                />
                <Line type="monotone" dataKey="v" stroke={isGood ? "#10B981" : "#EF4444"} strokeWidth={1.5} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-[#1A1A2E]/20">{firstDate}</span>
            <span className="text-[9px] text-[#1A1A2E]/20">{lastDate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- CR Share Section ---
function CrShareSection({ daily, creatives, crNames, colors }: {
  daily: Record<string, unknown>[];
  creatives: { name: string; cost: number; cv: number; cpa: number | null }[];
  crNames: string[];
  colors: string[];
}) {
  // Group small CRs (<1% share) into "その他"
  const totalCost = creatives.reduce((s, c) => s + c.cost, 0);
  const significantCrs = creatives.filter((c) => totalCost > 0 && (c.cost / totalCost) >= 0.01);
  const otherCrs = creatives.filter((c) => totalCost === 0 || (c.cost / totalCost) < 0.01);
  const displayCrs = otherCrs.length > 0 ? [...significantCrs, { name: "その他", cost: otherCrs.reduce((s, c) => s + c.cost, 0), cv: otherCrs.reduce((s, c) => s + c.cv, 0), cpa: null }] : significantCrs;
  const displayNames = displayCrs.map((c) => c.name);

  // Merge "その他" into daily
  const mergedDaily = useMemo(() => daily.map((day) => {
    const entry = { ...day };
    if (otherCrs.length > 0) {
      let otherShare = 0, otherCost = 0, otherCv = 0;
      for (const cr of otherCrs) {
        otherShare += Number(day[cr.name]) || 0;
        otherCost += Number(day[`${cr.name}__cost`]) || 0;
        otherCv += Number(day[`${cr.name}__cv`]) || 0;
      }
      entry["その他"] = Math.round(otherShare * 10) / 10;
      entry["その他__cost"] = Math.round(otherCost);
      entry["その他__cv"] = otherCv;
    }
    return entry;
  }), [daily, otherCrs]);

  // Reverse so largest cost at bottom of stack
  const stackOrder = [...displayNames].reverse();
  const colorMap = new Map(displayNames.map((n, i) => [n, n === "その他" ? "#D1D5DB" : colors[i % colors.length]]));

  const [hoveredCr, setHoveredCr] = useState<string | null>(null);

  function ShareTooltip({ active, label }: { active?: boolean; label?: string }) {
    if (!active || !hoveredCr || !label) return null;
    const dayData = daily.find((d) => d.date === label);
    if (!dayData) return null;
    const totalCost = dayData._totalCost as number ?? 0;
    const share = Number(dayData[hoveredCr]) || 0;
    const dayCost = Number(dayData[`${hoveredCr}__cost`]) || 0;
    const dayCv = Number(dayData[`${hoveredCr}__cv`]) || 0;
    const dayCpa = dayCv > 0 ? Math.round(dayCost / dayCv) : null;
    return (
      <div className="bg-white rounded-lg shadow-lg border border-black/[0.08] p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorMap.get(hoveredCr) }} />
          <p className="text-[11px] font-semibold text-[#1A1A2E] truncate">{hoveredCr}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <span className="text-[#1A1A2E]/40">シェア</span><span className="text-right font-medium text-[#1A1A2E]">{share}%</span>
          <span className="text-[#1A1A2E]/40">COST</span><span className="text-right font-medium text-[#1A1A2E]">¥{dayCost.toLocaleString()}</span>
          <span className="text-[#1A1A2E]/40">CV</span><span className="text-right font-medium text-[#1A1A2E]">{dayCv}</span>
          <span className="text-[#1A1A2E]/40">CPA</span><span className="text-right font-medium text-[#1A1A2E]">{dayCpa ? `¥${dayCpa.toLocaleString()}` : "-"}</span>
        </div>
        <p className="text-[10px] text-[#1A1A2E]/25 mt-2">{label} 合計 ¥{totalCost.toLocaleString()}</p>
      </div>
    );
  }

  // Aggregate COST/CPA trend (全広告合計)
  const trendData = useMemo(() =>
    daily.map((day) => {
      let totalCost = 0, totalCv = 0;
      for (const cr of crNames) {
        totalCost += Number(day[`${cr}__cost`]) || 0;
        totalCv += Number(day[`${cr}__cv`]) || 0;
      }
      return {
        date: day.date as string,
        cost: Math.round(totalCost),
        cpa: totalCv > 0 ? Math.round(totalCost / totalCv) : 0,
        cv: totalCv,
      };
    }), [daily, crNames]);

  return (
    <div className="content-card rounded-xl p-5">
      {/* Cost share bar chart — no XAxis (shared with chart below) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#1A1A2E]">CR別コストシェア推移</h3>
          <span className="text-[10px] text-[#1A1A2E]/30">{creatives.length} CR</span>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 h-40">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={mergedDaily} margin={{ left: 0, right: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#999" }} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} width={45} domain={[0, 100]} />
                <Tooltip content={<ShareTooltip />} />
                {stackOrder.map((name) => (
                  <Bar key={name} dataKey={name} stackId="1"
                    fill={colorMap.get(name)} fillOpacity={hoveredCr && hoveredCr !== name ? 0.15 : 0.85}
                    onMouseEnter={() => setHoveredCr(name)} onMouseLeave={() => setHoveredCr(null)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="w-[240px] shrink-0 space-y-0.5 max-h-40 overflow-y-auto">
            {displayCrs.map((cr, i) => {
              const share = totalCost > 0 ? Math.round((cr.cost / totalCost) * 1000) / 10 : 0;
              return (
                <div key={cr.name} className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${hoveredCr && hoveredCr !== cr.name ? "opacity-30" : ""}`}
                  onMouseEnter={() => setHoveredCr(cr.name)} onMouseLeave={() => setHoveredCr(null)}>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorMap.get(cr.name) }} />
                  <span className="text-[11px] text-[#1A1A2E]/70 flex-1 leading-tight" title={cr.name}>{cr.name}</span>
                  <span className="text-[10px] font-medium text-[#1A1A2E]/40 shrink-0">{share}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* COST + CPA trend — shares XAxis with chart above */}
      <div className="flex gap-4 mt-1">
        <div className="flex-1">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={trendData} margin={{ left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#999" }} interval={trendData.length > 14 ? 1 : 0} />
                <YAxis yAxisId="cost" tick={{ fontSize: 10, fill: "#6366F1" }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} width={45} />
                <YAxis yAxisId="cpa" orientation="right" tick={{ fontSize: 10, fill: "#EF4444" }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} width={45} domain={[0, "auto"]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #eee", fontSize: 11 }}
                  formatter={(v: number | null, name: string) => [v ? `¥${v.toLocaleString()}` : "-", name === "cost" ? "COST" : "CPA"]} />
                <Bar yAxisId="cost" dataKey="cost" fill="#6366F1" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                <Line yAxisId="cpa" type="monotone" dataKey="cpa" stroke="#EF4444" strokeWidth={2}
                  dot={(props: Record<string, unknown>) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { cpa: number } };
                    const isZero = payload?.cpa === 0;
                    return <circle cx={cx} cy={cy} r={3} fill={isZero ? "#D1D5DB" : "#EF4444"} stroke="none" />;
                  }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-1 justify-end">
            <span className="flex items-center gap-1 text-[10px] text-[#1A1A2E]/40"><span className="w-3 h-2 rounded-sm bg-[#6366F1]/60" />COST</span>
            <span className="flex items-center gap-1 text-[10px] text-[#1A1A2E]/40"><span className="w-3 h-0.5 bg-[#EF4444]" />CPA</span>
          </div>
        </div>
        <div className="w-[240px] shrink-0" />
      </div>
    </div>
  );
}

const METRIC_COLS = [
  { key: "cost", label: "COST" },
  { key: "cv", label: "CV" },
  { key: "cpa", label: "CPA" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "mcvr", label: "MCVR" },
  { key: "mcpa", label: "MCPA" },
  { key: "lpcvr", label: "LPCVR" },
  { key: "cvr", label: "CVR" },
] as const;

const LEVEL_LABELS: Record<Level, string> = {
  campaign: "キャンペーン",
  adset: "広告セット",
  ad: "広告",
};

export default function OperationsPage() {
  const { currentProject } = useProject();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [platform, setPlatform] = useState<Platform>(() => (searchParams.get("platform") as Platform) || "meta");
  const [level, setLevel] = useState<Level>(() => (searchParams.get("level") as Level) || "campaign");
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("cpnId");
    const name = searchParams.get("cpnName");
    return id && name ? { id, name: decodeURIComponent(name) } : null;
  });
  const [selectedAdset, setSelectedAdset] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("asId");
    const name = searchParams.get("asName");
    return id && name ? { id, name: decodeURIComponent(name) } : null;
  });

  // Sync state to URL
  const syncUrl = useCallback((lvl: Level, cpn: { id: string; name: string } | null, as_: { id: string; name: string } | null, plat: Platform) => {
    const params = new URLSearchParams();
    params.set("platform", plat);
    params.set("level", lvl);
    if (cpn) { params.set("cpnId", cpn.id); params.set("cpnName", cpn.name); }
    if (as_) { params.set("asId", as_.id); params.set("asName", as_.name); }
    router.replace(`/operations?${params.toString()}`, { scroll: false });
  }, [router]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [crShareData, setCrShareData] = useState<{ daily: Record<string, unknown>[]; creatives: string[] } | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Date range
  const todayStr = new Date().toISOString().slice(0, 10);
  const DATE_PRESETS = [
    { key: "today", label: "今日", from: todayStr, to: todayStr },
    { key: "yesterday", label: "昨日", from: new Date(Date.now() - 86400000).toISOString().slice(0, 10), to: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    { key: "7d", label: "過去7日", from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: todayStr },
    { key: "30d", label: "過去30日", from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: todayStr },
    { key: "custom", label: "カスタム", from: "", to: "" },
  ] as const;
  type PresetKey = (typeof DATE_PRESETS)[number]["key"];
  const [datePreset, setDatePreset] = useState<PresetKey>("today");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [showDatePicker, setShowDatePicker] = useState(false);

  function applyPreset(key: PresetKey) {
    setDatePreset(key);
    if (key === "custom") {
      setShowDatePicker(true);
    } else {
      const preset = DATE_PRESETS.find((p) => p.key === key)!;
      setDateFrom(preset.from);
      setDateTo(preset.to);
      setShowDatePicker(false);
    }
  }

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Fetch all data
  function fetchAll(showLoading = true) {
    if (showLoading) setLoading(true);

    // KPI (scoped to selected campaign/adset)
    let kpiUrl = `/api/operations/kpi?projectId=${currentProject.id}&from=${dateFrom}&to=${dateTo}&platform=${platform}`;
    if (selectedCampaign) kpiUrl += `&campaignId=${selectedCampaign.id}`;
    if (selectedAdset) kpiUrl += `&adsetId=${selectedAdset.id}`;
    fetch(kpiUrl)
      .then((r) => r.json())
      .then((data) => setKpi(data.error ? null : data))
      .catch(() => setKpi(null));

    // CR impression share (when at ad level)
    if (level === "ad" && selectedAdset) {
      let shareUrl = `/api/operations/cr-share?projectId=${currentProject.id}&adsetId=${selectedAdset.id}&platform=${platform}`;
      if (dateFrom) shareUrl += `&from=${dateFrom}`;
      if (dateTo) shareUrl += `&to=${dateTo}`;
      fetch(shareUrl)
        .then((r) => r.json())
        .then((data) => setCrShareData(data.error ? null : data))
        .catch(() => setCrShareData(null));
    } else {
      setCrShareData(null);
    }

    // Table
    let url = `/api/operations?projectId=${currentProject.id}&platform=${platform}&level=${level}`;
    if (level === "adset" && selectedCampaign) url += `&campaignId=${selectedCampaign.id}`;
    if (level === "ad" && selectedAdset) url += `&adsetId=${selectedAdset.id}`;
    if (dateFrom) url += `&from=${dateFrom}`;
    if (dateTo) url += `&to=${dateTo}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setRows(arr);
        if (platform === "meta" && arr.length > 0) {
          const ids = arr.map((r: Row) => r.id).join(",");
          fetch(`/api/operations/status?level=${level}&ids=${ids}`)
            .then((r) => r.json())
            .then((s) => { if (!s.error) setStatuses((prev) => ({ ...prev, ...s })); })
            .catch(() => {});
        }
      })
      .catch(() => setRows([]))
      .finally(() => { setLoading(false); setLastRefresh(new Date()); });
  }

  // Initial fetch + refetch on param changes
  useEffect(() => {
    fetchAll(true);
  }, [currentProject.id, platform, level, selectedCampaign, selectedAdset, dateFrom, dateTo]);

  // Auto-refresh every 15 min when date range includes today
  useEffect(() => {
    const includestoday = dateTo >= todayStr;
    if (!includestoday) return;
    const interval = setInterval(() => fetchAll(false), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentProject.id, platform, level, selectedCampaign, selectedAdset, dateFrom, dateTo]);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortKey];
      const vb = (b as Record<string, unknown>)[sortKey];
      const na = (typeof va === "number" ? va : va ?? -1) as number;
      const nb = (typeof vb === "number" ? vb : vb ?? -1) as number;
      return sortDir === "asc" ? na - nb : nb - na;
    });
  }, [rows, sortKey, sortDir]);

  interface LogEntry { id: string; timestamp: string; type: string; target: string; detail: string; status: "success" | "error"; error?: string }
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function refreshLogs() {
    fetch("/api/operations/logs?limit=15")
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  // Fetch logs on mount and after data refresh
  useEffect(() => { refreshLogs(); }, [lastRefresh]);

  async function toggleStatus(id: string, name: string) {
    const current = statuses[id];
    if (!current || current === "UNKNOWN") return;
    const newStatus = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setTogglingId(id);
    try {
      const res = await fetch("/api/operations/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, level, name }),
      });
      const data = await res.json();
      if (data.success) {
        setStatuses((prev) => ({ ...prev, [id]: data.effectiveStatus ?? newStatus }));
      }
      refreshLogs();
    } catch { /* ignore */ }
    setTogglingId(null);
  }

  function navigateTo(newLevel: Level, campaign?: { id: string; name: string }, adset?: { id: string; name: string }) {
    setSortKey(null);
    setLevel(newLevel);
    const newCpn = campaign !== undefined ? campaign : selectedCampaign;
    const newAs = adset !== undefined ? adset : selectedAdset;
    if (campaign !== undefined) setSelectedCampaign(campaign);
    if (adset !== undefined) setSelectedAdset(adset);
    syncUrl(newLevel, newCpn, newAs, platform);
  }

  function handleRowClick(row: Row) {
    if (level === "campaign") {
      navigateTo("adset", { id: row.id, name: row.name });
    } else if (level === "adset") {
      navigateTo("ad", undefined, { id: row.id, name: row.name });
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">運用</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-[#1A1A2E]/40">{currentProject.name} — 広告管理</p>
            {lastRefresh && (
              <span className="text-[10px] text-[#1A1A2E]/25">
                更新: {lastRefresh.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {dateTo >= todayStr && (
              <span className="text-[10px] text-[#1A1A2E]/20">（15分ごと自動更新）</span>
            )}
            <button
              onClick={() => fetchAll(false)}
              className="w-5 h-5 rounded flex items-center justify-center text-[#1A1A2E]/30 hover:text-[#9333EA] hover:bg-[#9333EA]/5 transition-colors"
              title="手動更新"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                datePreset === p.key
                  ? "bg-[#1A1A2E] text-white"
                  : "text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60 hover:bg-black/[0.03]"
              }`}
            >
              {p.key === "custom" && datePreset === "custom"
                ? `${dateFrom} 〜 ${dateTo}`
                : p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date picker */}
      {showDatePicker && (
        <div className="flex items-center gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30" />
          <span className="text-[11px] text-[#1A1A2E]/30">〜</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30" />
          <button
            onClick={() => setShowDatePicker(false)}
            className="px-3 py-1.5 rounded-lg bg-[#9333EA] text-white text-[12px] font-medium hover:opacity-90"
          >
            適用
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {kpi && level !== "ad" && (
        <>
          {(selectedCampaign || selectedAdset) && (
            <p className="text-[11px] text-[#9333EA] font-medium">
              {selectedAdset ? `${selectedCampaign?.name} > ${selectedAdset.name}` : selectedCampaign?.name} のサマリー
            </p>
          )}
          <div className="grid grid-cols-5 gap-3">
            {KPI_DEFS.map((def, i) => (
              <KpiCard
                key={def.key}
                def={def}
                selectedVal={kpi.selected[def.key] as number | null}
                comparisonVal={kpi.comparison[def.key] as number | null}
                comparisonLabel={kpi.comparisonLabel}
                daily={kpi.daily.map((d) => ({ date: d.date as string, value: d[def.key] as number | null }))}
                gradient={GRADIENT_COLORS[i]}
              />
            ))}
          </div>
        </>
      )}

      {/* CR Cost Share Chart (ad level only) */}
      {crShareData && crShareData.daily.length > 0 && (() => {
        const SHARE_COLORS = ["#9333EA", "#6366F1", "#22D3EE", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#06B6D4", "#84CC16"];
        const crs = crShareData.creatives as { name: string; cost: number; cv: number; cpa: number | null }[];
        const crNames = crs.map((c) => c.name);

        return (
          <CrShareSection
            daily={crShareData.daily}
            creatives={crs}
            crNames={crNames}
            colors={SHARE_COLORS}
          />
        );
      })()}

      {/* Platform tabs */}
      <div className="flex gap-2">
        {(["meta", "tiktok"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setSelectedCampaign(null); setSelectedAdset(null); setLevel("campaign"); syncUrl("campaign", null, null, p); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              platform === p ? "bg-[#9333EA] text-white" : "bg-[#1A1A2E]/[0.04] text-[#1A1A2E]/50 hover:bg-[#1A1A2E]/[0.08]"
            }`}
          >
            {p === "meta" ? "Meta" : "TikTok"}
          </button>
        ))}
      </div>

      {/* Level tabs + breadcrumb */}
      <div className="flex items-center gap-2">
        {(["campaign", "adset", "ad"] as Level[]).map((l) => (
          <button
            key={l}
            onClick={() => {
              if (l === "campaign") navigateTo("campaign", null as never, null as never);
              else if (l === "adset" && selectedCampaign) navigateTo("adset");
              else if (l === "ad" && selectedAdset) navigateTo("ad");
            }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              level === l ? "bg-[#1A1A2E] text-white" : "text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60 hover:bg-black/[0.02]"
            }`}
          >
            {LEVEL_LABELS[l]}
          </button>
        ))}

        {/* Breadcrumb */}
        {(selectedCampaign || selectedAdset) && (
          <div className="flex items-center gap-1 ml-3 text-[12px] text-[#1A1A2E]/40">
            <button onClick={() => navigateTo("campaign", null as never, null as never)} className="hover:text-[#9333EA] transition-colors">
              全キャンペーン
            </button>
            {selectedCampaign && (
              <>
                <ChevronRight className="w-3 h-3" />
                <button
                  onClick={() => navigateTo("adset")}
                  className={`hover:text-[#9333EA] transition-colors max-w-[200px] truncate ${level === "adset" ? "text-[#1A1A2E]/70 font-medium" : ""}`}
                >
                  {selectedCampaign.name}
                </button>
              </>
            )}
            {selectedAdset && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[#1A1A2E]/70 font-medium max-w-[200px] truncate">{selectedAdset.name}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#9333EA] animate-spin" />
        </div>
      ) : (
        <div className="content-card rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-black/[0.04]">
                {level === "ad" && (
                  <th className="text-left px-3 py-3 text-[12px] font-semibold text-[#1A1A2E]/35">サムネイル</th>
                )}
                <th
                  className="text-left px-3 py-3 text-[12px] font-semibold text-[#1A1A2E]/35 cursor-pointer hover:text-[#9333EA]"
                  onClick={() => handleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    {LEVEL_LABELS[level]}名
                    {sortKey === "name" ? (sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
                {METRIC_COLS.map((col) => (
                  <th
                    key={col.key}
                    className={`text-right px-3 py-3 text-[12px] font-semibold whitespace-nowrap cursor-pointer hover:text-[#9333EA] transition-colors ${
                      sortKey === col.key ? "text-[#9333EA]" : "text-[#1A1A2E]/35"
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      {col.label}
                      {sortKey === col.key ? (sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={METRIC_COLS.length + 2} className="px-4 py-12 text-center text-sm text-[#1A1A2E]/30">
                    データがありません
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-black/[0.01] transition-colors ${level !== "ad" ? "cursor-pointer" : ""}`}
                    onClick={() => handleRowClick(row)}
                  >
                    {level === "ad" && (
                      <td className="px-3 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); row.previewUrl && setPreviewUrl(row.previewUrl); }}
                          className={`w-16 h-11 rounded-lg overflow-hidden bg-[#1A1A2E]/[0.04] ${row.previewUrl ? "cursor-pointer hover:opacity-80 transition-opacity group relative" : ""}`}
                        >
                          {row.thumbnailUrl ? (
                            <>
                              <img src={row.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              {row.previewUrl && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-[13px] font-medium text-[#1A1A2E]">
                      <div className="flex items-center gap-2 max-w-[350px]">
                        {/* Status toggle */}
                        {platform === "meta" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStatus(row.id, row.name); }}
                            disabled={togglingId === row.id || !statuses[row.id] || statuses[row.id] === "UNKNOWN"}
                            className={`w-8 h-[18px] rounded-full relative shrink-0 transition-colors ${
                              togglingId === row.id ? "opacity-50" :
                              statuses[row.id] === "ACTIVE" ? "bg-emerald-500" :
                              statuses[row.id] === "PAUSED" ? "bg-[#1A1A2E]/20" :
                              "bg-[#1A1A2E]/10"
                            }`}
                            title={statuses[row.id] ?? "読込中..."}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[2px] transition-all ${
                              statuses[row.id] === "ACTIVE" ? "left-[16px]" : "left-[2px]"
                            }`} />
                          </button>
                        )}
                        {level !== "ad" && <ChevronRight className="w-3 h-3 shrink-0 text-[#1A1A2E]/20" />}
                        <span className="truncate">{level === "ad" && row.creativeName ? row.creativeName : row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(Math.round(row.cost), "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-bold text-[#1A1A2E]">{row.cv}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.cpa, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.ctr, "", "%")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.cpc, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.mcvr, "", "%")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.mcpa, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.lpcvr, "", "%")}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.cvr, "", "%")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-black/[0.04] text-[11px] text-[#1A1A2E]/30">
            {sorted.length} 件
          </div>
        </div>
      )}

      {/* Operation Logs */}
      {logs.length > 0 && (
        <div className="content-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.04]">
            <h3 className="text-sm font-bold text-[#1A1A2E]">実行ログ</h3>
          </div>
          <div className="divide-y divide-black/[0.03] max-h-[300px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-[12px]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="text-[#1A1A2E]/30 w-[130px] shrink-0">
                  {new Date(log.timestamp).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                  log.type === "データ同期" ? "bg-blue-50 text-blue-600" :
                  log.type === "ステータス変更" ? "bg-purple-50 text-purple-600" :
                  log.type === "入稿" ? "bg-amber-50 text-amber-600" :
                  "bg-gray-50 text-gray-600"
                }`}>
                  {log.type}
                </span>
                <span className="text-[#1A1A2E]/60 truncate flex-1">{log.target}</span>
                <span className="text-[#1A1A2E]/40 shrink-0">{log.detail}</span>
                {log.error && (
                  <span className="text-red-500 truncate max-w-[200px]" title={log.error}>{log.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {previewUrl && (
        <VideoPreviewModal previewUrl={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}
