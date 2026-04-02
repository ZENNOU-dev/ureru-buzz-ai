"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, Play, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
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
          <div className="h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
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
  const [platform, setPlatform] = useState<Platform>("meta");
  const [level, setLevel] = useState<Level>("campaign");
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: string; name: string } | null>(null);
  const [selectedAdset, setSelectedAdset] = useState<{ id: string; name: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string | null>(null);
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
    let kpiUrl = `/api/operations/kpi?projectId=${currentProject.id}&from=${dateFrom}&to=${dateTo}`;
    if (selectedCampaign) kpiUrl += `&campaignId=${selectedCampaign.id}`;
    if (selectedAdset) kpiUrl += `&adsetId=${selectedAdset.id}`;
    fetch(kpiUrl)
      .then((r) => r.json())
      .then((data) => setKpi(data.error ? null : data))
      .catch(() => setKpi(null));

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
    if (campaign !== undefined) setSelectedCampaign(campaign);
    if (adset !== undefined) setSelectedAdset(adset);
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
      {kpi && (
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

      {/* Platform tabs */}
      <div className="flex gap-2">
        {(["meta", "tiktok"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); navigateTo("campaign", null as never, null as never); setSelectedCampaign(null); setSelectedAdset(null); }}
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
