"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, ChevronDown, Play, TrendingUp, TrendingDown, RefreshCw, Plus, X, Upload, Check, Settings, Trash2, Search, Image } from "lucide-react";
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

interface BudgetInfo {
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  bidStrategy: string | null;
  bidAmount: number | null;
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

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onClose]);
}

function BudgetEditor({ budget, onSave, onClose }: {
  budget: BudgetInfo;
  onSave: (changes: { dailyBudget?: number }) => void;
  onClose: () => void;
}) {
  const [dailyBudget, setDailyBudget] = useState(String(budget.dailyBudget ?? ""));
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-black/[0.08] p-4 w-56" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">日予算 (¥)</label>
          <input
            type="number"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-black/[0.08] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
            placeholder="例: 10000"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#1A1A2E]/40 hover:bg-black/[0.03]">キャンセル</button>
          <button onClick={() => {
            const v = Number(dailyBudget);
            if (v && v !== budget.dailyBudget) onSave({ dailyBudget: v });
            else onClose();
          }} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#9333EA] text-white hover:bg-[#7E22CE]">更新</button>
        </div>
      </div>
    </div>
  );
}

function BidEditor({ budget, onSave, onClose }: {
  budget: BudgetInfo;
  onSave: (changes: { bidStrategy?: string; bidAmount?: number }) => void;
  onClose: () => void;
}) {
  const [bidStrategy, setBidStrategy] = useState(budget.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState(String(budget.bidAmount ?? ""));
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-black/[0.08] p-4 w-56" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">入札戦略</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => setBidStrategy("LOWEST_COST_WITHOUT_CAP")}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                bidStrategy === "LOWEST_COST_WITHOUT_CAP" ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/50 hover:bg-black/[0.06]"
              }`}
            >CV最大化</button>
            <button
              onClick={() => setBidStrategy("COST_CAP")}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                bidStrategy === "COST_CAP" ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/50 hover:bg-black/[0.06]"
              }`}
            >tCPA</button>
          </div>
        </div>
        {bidStrategy === "COST_CAP" && (
          <div>
            <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">目標CPA (¥)</label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-black/[0.08] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
              placeholder="例: 5000"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#1A1A2E]/40 hover:bg-black/[0.03]">キャンセル</button>
          <button onClick={() => {
            const changes: { bidStrategy?: string; bidAmount?: number } = {};
            if (bidStrategy !== budget.bidStrategy) changes.bidStrategy = bidStrategy;
            if (bidStrategy === "COST_CAP") {
              const amt = Number(bidAmount);
              if (amt && amt !== budget.bidAmount) changes.bidAmount = amt;
            }
            if (Object.keys(changes).length > 0) onSave(changes);
            else onClose();
          }} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#9333EA] text-white hover:bg-[#7E22CE]">更新</button>
        </div>
      </div>
    </div>
  );
}

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
  const [budgets, setBudgets] = useState<Record<string, BudgetInfo>>({});
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBidId, setEditingBidId] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showPresetPanel, setShowPresetPanel] = useState(false);

  // Submission queue
  interface QueueItem { id: string; data: SubmitAdFormData; status: "pending" | "running" | "success" | "error"; error?: string; resultCount?: number }
  const [submitQueue, setSubmitQueue] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);

  async function runQueue() {
    setQueueRunning(true);
    for (const item of submitQueue) {
      if (item.status === "success") continue;
      setSubmitQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "running", error: undefined } : q));
      try {
        const res = await fetch("/api/operations/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        });
        const result = await res.json();
        if (result.error) {
          setSubmitQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "error", error: result.error } : q));
        } else {
          const ok = ((result.ads ?? []) as { error?: string }[]).filter((a) => !a.error).length;
          setSubmitQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "success", resultCount: ok } : q));
        }
      } catch (e) {
        setSubmitQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "error", error: (e as Error).message } : q));
      }
    }
    setQueueRunning(false);
    fetchAll(false);
    refreshLogs();
  }

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
          // Fetch budget/bid info for campaign or adset level
          if (level === "campaign" || level === "adset") {
            let budgetUrl = `/api/operations/budget?level=${level}&ids=${ids}`;
            if (level === "adset" && selectedCampaign) budgetUrl += `&campaignId=${selectedCampaign.id}`;
            fetch(budgetUrl)
              .then((r) => r.json())
              .then((b) => { if (!b.error) setBudgets((prev) => ({ ...prev, ...b })); })
              .catch(() => {});
          }
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

  async function updateBudget(id: string, name: string, changes: { dailyBudget?: number; bidStrategy?: string; bidAmount?: number }) {
    try {
      const res = await fetch("/api/operations/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, level, name, ...changes }),
      });
      const data = await res.json();
      if (data.success) {
        setBudgets((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            dailyBudget: changes.dailyBudget ?? prev[id]?.dailyBudget ?? null,
            bidStrategy: changes.bidStrategy ?? prev[id]?.bidStrategy ?? null,
            bidAmount: changes.bidAmount ?? prev[id]?.bidAmount ?? null,
            lifetimeBudget: prev[id]?.lifetimeBudget ?? null,
          },
        }));
        refreshLogs();
      } else {
        alert(`更新失敗: ${data.error}`);
      }
    } catch {
      alert("更新に失敗しました");
    }
    setEditingBudgetId(null);
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
          <button
            onClick={() => setShowSubmitForm(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#9333EA] text-white text-[12px] font-medium hover:bg-[#7E22CE] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            入稿
          </button>
          <button
            onClick={() => setShowPresetPanel(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1A1A2E]/30 hover:text-[#9333EA] hover:bg-[#9333EA]/5 transition-colors"
            title="入稿設定"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-black/[0.06]" />
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
                {platform === "meta" && level !== "ad" && (
                  <>
                    <th className="text-right px-3 py-3 text-[12px] font-semibold text-[#1A1A2E]/35 whitespace-nowrap">予算</th>
                    <th className="text-right px-3 py-3 text-[12px] font-semibold text-[#1A1A2E]/35 whitespace-nowrap">入札</th>
                  </>
                )}
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
                  <td colSpan={METRIC_COLS.length + 4} className="px-4 py-12 text-center text-sm text-[#1A1A2E]/30">
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
                    {platform === "meta" && level !== "ad" && (() => {
                      const b = budgets[row.id];
                      return (
                        <>
                          {/* 予算セル */}
                          <td className="px-3 py-2.5 text-right text-[13px] relative">
                            {b ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingBudgetId(editingBudgetId === row.id ? null : row.id); setEditingBidId(null); }}
                                className="hover:text-[#9333EA] transition-colors text-[#1A1A2E]/70 font-medium"
                              >
                                {b.dailyBudget ? `¥${b.dailyBudget.toLocaleString()}` : "-"}
                              </button>
                            ) : <span className="text-[#1A1A2E]/20">-</span>}
                            {editingBudgetId === row.id && b && (
                              <BudgetEditor
                                budget={b}
                                onSave={(changes) => updateBudget(row.id, row.name, changes)}
                                onClose={() => setEditingBudgetId(null)}
                              />
                            )}
                          </td>
                          {/* 入札セル */}
                          <td className="px-3 py-2.5 text-right text-[13px] relative">
                            {b ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingBidId(editingBidId === row.id ? null : row.id); setEditingBudgetId(null); }}
                                className="hover:text-[#9333EA] transition-colors text-right"
                              >
                                <span className="block text-[12px] text-[#1A1A2E]/60">
                                  {b.bidStrategy === "COST_CAP" ? "tCPA" : b.bidStrategy === "LOWEST_COST_WITHOUT_CAP" ? "CV最大化" : b.bidStrategy ?? "-"}
                                </span>
                                {b.bidStrategy === "COST_CAP" && b.bidAmount != null && (
                                  <span className="block text-[11px] text-[#9333EA] font-medium">¥{b.bidAmount.toLocaleString()}</span>
                                )}
                              </button>
                            ) : <span className="text-[#1A1A2E]/20">-</span>}
                            {editingBidId === row.id && b && (
                              <BidEditor
                                budget={b}
                                onSave={(changes) => updateBudget(row.id, row.name, changes)}
                                onClose={() => setEditingBidId(null)}
                              />
                            )}
                          </td>
                        </>
                      );
                    })()}
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

      {/* Submission Queue */}
      {submitQueue.length > 0 && (
        <div className="content-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1A1A2E]">入稿キュー</h3>
              <span className="text-[11px] text-[#1A1A2E]/30">{submitQueue.length}件</span>
              {queueRunning && <Loader2 className="w-3.5 h-3.5 text-[#9333EA] animate-spin" />}
            </div>
            <div className="flex items-center gap-2">
              {!queueRunning && submitQueue.some((q) => q.status === "pending" || q.status === "error") && (
                <button
                  onClick={runQueue}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9333EA] text-white text-[12px] font-medium hover:bg-[#7E22CE] transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  一括入稿実行
                </button>
              )}
              {!queueRunning && submitQueue.every((q) => q.status === "success") && (
                <button
                  onClick={() => setSubmitQueue([])}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#1A1A2E]/30 hover:text-[#1A1A2E]/60 hover:bg-black/[0.03] transition-colors"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-black/[0.03]">
            {submitQueue.map((item, idx) => {
              const crCount = item.data.creatives.filter((c) => c.creativeName.trim()).length;
              const label = item.data.mode === "existing" ? "既存CPN追加" : item.data.campaignName || "新規CPN";
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Status icon */}
                  <span className="w-6 text-center text-[12px] font-bold text-[#1A1A2E]/20">{idx + 1}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    item.status === "success" ? "bg-emerald-500" :
                    item.status === "error" ? "bg-red-500" :
                    item.status === "running" ? "bg-[#9333EA] animate-pulse" :
                    "bg-[#1A1A2E]/15"
                  }`} />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1A1A2E] truncate">{label}</p>
                    <p className="text-[10px] text-[#1A1A2E]/30">
                      {item.data.bidStrategy === "cost_cap" ? "tCPA" : "CV最大"} ¥{Number(item.data.budget || 0).toLocaleString()} / {crCount}CR
                      {item.status === "success" && item.resultCount !== undefined && ` → ${item.resultCount}件完了`}
                    </p>
                    {item.error && (
                      <p className="text-[10px] text-red-500 truncate mt-0.5" title={item.error}>{item.error}</p>
                    )}
                  </div>
                  {/* Actions */}
                  {!queueRunning && (
                    <div className="flex items-center gap-1 shrink-0">
                      {(item.status === "pending" || item.status === "error") && (
                        <button
                          onClick={() => { setEditingQueueId(item.id); }}
                          className="px-2 py-1 rounded text-[10px] font-medium text-[#9333EA] hover:bg-[#9333EA]/5 transition-colors"
                        >
                          編集
                        </button>
                      )}
                      {item.status === "error" && (
                        <button
                          onClick={() => setSubmitQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "pending" as const, error: undefined } : q))}
                          className="px-2 py-1 rounded text-[10px] font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          リトライ
                        </button>
                      )}
                      <button
                        onClick={() => setSubmitQueue((prev) => prev.filter((q) => q.id !== item.id))}
                        className="w-5 h-5 rounded flex items-center justify-center text-[#1A1A2E]/15 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Submit Form Modal */}
      {(showSubmitForm || editingQueueId) && (
        <SubmitAdForm
          platform={platform}
          projectId={currentProject.id}
          currentCampaign={selectedCampaign}
          currentAdset={selectedAdset}
          currentLevel={level}
          initialData={editingQueueId ? submitQueue.find((q) => q.id === editingQueueId)?.data : undefined}
          onClose={() => { setShowSubmitForm(false); setEditingQueueId(null); }}
          onSubmit={async (data) => {
            if (editingQueueId) {
              // Update existing queue item
              setSubmitQueue((prev) => prev.map((q) => q.id === editingQueueId ? { ...q, data, status: "pending" as const, error: undefined } : q));
              setEditingQueueId(null);
            } else {
              // Add to queue
              const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              setSubmitQueue((prev) => [...prev, { id, data, status: "pending" }]);
            }
            setShowSubmitForm(false);
          }}
        />
      )}

      {/* Preset Settings Panel */}
      {showPresetPanel && (
        <PresetSettingsPanel
          projectId={currentProject.id}
          platform={platform}
          onClose={() => setShowPresetPanel(false)}
        />
      )}

      {previewUrl && (
        <VideoPreviewModal previewUrl={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}

// --- Shared Types for Form ---
interface CreativeEntry {
  creativeName: string;
  creativeUrl: string;
  thumbnailUrl: string | null;
}

interface SubmitAdFormData {
  mode: "existing" | "new";
  presetId: string;
  accountId: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  creatives: CreativeEntry[];
  urlType: "articleLp" | "clickUrl";
  articleLpId: string;
  articleLpName: string;
  articleLpUrl: string;
  clickUrl: string;
  advantageAudience: boolean;
  gender: string;
  ageMin: string;
  ageMax: string;
  geoPresetId: string;
  valueRuleId: string;
  bidStrategy: "lowest_cost" | "cost_cap";
  advantagePlacement: boolean;
  placements: string[];
  budget: string;
  bidAmount: string;
  targeting: string;
  startDate: string;
  endDate: string;
  defaultTitle: string;
  defaultBody: string;
  defaultDescription: string;
  operator: string;
  memo: string;
}

interface CampaignOption { id: string; name: string; status: string; accountId: string | null }
interface AdsetOption { id: string; name: string; campaignId: string }
interface AccountOption { accountId: string; accountName: string; isTarget: boolean; operatorName: string | null }
interface LpOption { id: number; name: string; url: string; appealName: string }
interface CatsClickUrlOption { id: number; name: string; url: string; articleLpName: string | null }
interface GeoPresetOption { id: number; name: string; config: Record<string, unknown> }
interface ValueRuleOption { id: number; accountId: string; ruleName: string; metaRuleId: string }
interface PresetOption {
  id: number; presetName: string;
  gender: string; ageMin: number; ageMax: number;
  defaultTitle: string | null; defaultBody: string | null; defaultDescription: string | null;
  geoPresetId: number | null; valueRuleId: number | null;
  placementPresetId: number | null;
  placementConfig: Record<string, unknown> | null;
}

const PLACEMENT_OPTIONS = [
  { value: "ig_reels", label: "IG Reels" },
  { value: "ig_feed", label: "IG Feed" },
  { value: "ig_stories", label: "IG Stories" },
  { value: "ig_other", label: "IG その他" },
  { value: "fb_reels", label: "FB Reels" },
  { value: "fb_feed", label: "FB Feed" },
  { value: "fb_stories", label: "FB Stories" },
  { value: "fb_other", label: "FB その他" },
  { value: "audience_network", label: "Audience Network" },
];

const GENDER_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
];

function SubmitAdForm({ platform, projectId, currentCampaign, currentAdset, currentLevel, initialData, onClose, onSubmit }: {
  platform: Platform;
  projectId: string | number;
  currentCampaign: { id: string; name: string } | null;
  currentAdset: { id: string; name: string } | null;
  currentLevel: Level;
  initialData?: SubmitAdFormData;
  onClose: () => void;
  onSubmit: (data: SubmitAdFormData) => void | Promise<void>;
}) {
  // Auto-select mode based on current hierarchy
  const autoMode = (currentCampaign || currentAdset) ? "existing" as const : "existing" as const;

  const [form, setForm] = useState<SubmitAdFormData>(initialData ?? {
    mode: autoMode,
    presetId: "",
    accountId: "",
    campaignId: currentCampaign?.id ?? "",
    campaignName: "",
    adsetId: currentAdset?.id ?? "",
    adsetName: "",
    creatives: [{ creativeName: "", creativeUrl: "", thumbnailUrl: null }],
    urlType: "articleLp",
    articleLpId: "",
    articleLpName: "",
    articleLpUrl: "",
    clickUrl: "",
    bidStrategy: "lowest_cost",
    advantageAudience: false,
    gender: "all",
    ageMin: "18",
    ageMax: "65",
    geoPresetId: "",
    valueRuleId: "",
    advantagePlacement: true,
    placements: [],
    defaultTitle: "",
    defaultBody: "",
    defaultDescription: "",
    operator: "",
    budget: "",
    bidAmount: "",
    targeting: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    memo: "",
  });

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [adsets, setAdsets] = useState<AdsetOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [articleLps, setArticleLps] = useState<LpOption[]>([]);
  const [catsClickUrls, setCatsClickUrls] = useState<CatsClickUrlOption[]>([]);
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [geoPresets, setGeoPresets] = useState<GeoPresetOption[]>([]);
  const [valueRules, setValueRules] = useState<ValueRuleOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [showCrPicker, setShowCrPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch form options
  useEffect(() => {
    fetch(`/api/operations/form-options?projectId=${projectId}&platform=${platform}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setCampaigns(data.campaigns ?? []);
          setAdsets(data.adsets ?? []);
          setAccounts(data.accounts ?? []);
          setArticleLps(data.articleLps ?? []);
          setCatsClickUrls(data.catsClickUrls ?? []);
          setPresets(data.presets ?? []);
          setGeoPresets(data.geoPresets ?? []);
          setValueRules(data.valueRules ?? []);
          // Auto-resolve account: from current campaign or single target account
          const cpns = data.campaigns ?? [];
          const accts = data.accounts ?? [];
          if (currentCampaign) {
            const cpn = cpns.find((c: CampaignOption) => c.id === currentCampaign.id);
            if (cpn?.accountId) {
              const acct = accts.find((a: AccountOption) => a.accountId === cpn.accountId);
              setForm((prev) => ({
                ...prev,
                accountId: cpn.accountId,
                operator: prev.operator || acct?.operatorName || "",
              }));
            }
          } else {
            const targetAccounts = accts.filter((a: AccountOption) => a.isTarget);
            if (targetAccounts.length === 1) {
              setForm((prev) => ({
                ...prev,
                accountId: targetAccounts[0].accountId,
                operator: prev.operator || targetAccounts[0].operatorName || "",
              }));
            }
          }
          // Auto-select URL type based on click_type
          if (data.clickType === "direct_click") {
            setForm((prev) => ({ ...prev, urlType: "clickUrl" }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, [projectId, platform]);

  const update = (key: keyof SubmitAdFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isExisting = form.mode === "existing";

  // Filter adsets by selected campaign
  const filteredAdsets = form.campaignId
    ? adsets.filter((a) => a.campaignId === form.campaignId)
    : adsets;

  const togglePlacement = (val: string) => {
    setForm((prev) => ({
      ...prev,
      placements: prev.placements.includes(val)
        ? prev.placements.filter((p) => p !== val)
        : [...prev.placements, val],
    }));
  };

  // Creative list management
  const addCreative = () =>
    setForm((prev) => ({ ...prev, creatives: [...prev.creatives, { creativeName: "", creativeUrl: "", thumbnailUrl: null }] }));

  const removeCreative = (idx: number) =>
    setForm((prev) => ({ ...prev, creatives: prev.creatives.filter((_, i) => i !== idx) }));

  const updateCreative = (idx: number, key: keyof CreativeEntry, value: string) =>
    setForm((prev) => ({
      ...prev,
      creatives: prev.creatives.map((c, i) => i === idx ? { ...c, [key]: value } : c),
    }));

  // Select article LP → auto-fill URL
  const selectArticleLp = (lpId: string) => {
    const lp = articleLps.find((l) => String(l.id) === lpId);
    setForm((prev) => ({
      ...prev,
      articleLpId: lpId,
      articleLpName: lp?.name ?? "",
      articleLpUrl: lp?.url ?? "",
    }));
  };

  const hasCreatives = form.creatives.some((c) => c.creativeName.trim());
  const canSubmit = isExisting
    ? form.accountId && form.campaignId && form.adsetId && hasCreatives
    : form.accountId && form.campaignName && form.adsetName && hasCreatives;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      {/* CR Picker Panel (slides from left of the form) */}
      {showCrPicker && (
        <CreativePickerPanel
          projectId={String(projectId)}
          selectedCrs={form.creatives.filter((c) => c.creativeName.trim())}
          onSelect={(selected) => {
            setForm((prev) => ({ ...prev, creatives: selected.length > 0 ? selected : [{ creativeName: "", creativeUrl: "", thumbnailUrl: null }] }));
          }}
          onClose={() => setShowCrPicker(false)}
        />
      )}
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-black/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9333EA]/10 flex items-center justify-center">
              <Upload className="w-4 h-4 text-[#9333EA]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1A1A2E]">広告入稿</h2>
              <p className="text-[11px] text-[#1A1A2E]/35">{platform === "meta" ? "Meta Ads" : "TikTok Ads"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors">
            <X className="w-4 h-4 text-[#1A1A2E]/40" />
          </button>
        </div>

        {optionsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-[#9333EA] animate-spin" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Context bar (auto-selected) */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#9333EA]/[0.04] border border-[#9333EA]/10">
              <span className="text-[11px] text-[#9333EA]/60">自動選択:</span>
              <span className="text-[11px] font-medium text-[#9333EA]">{platform === "meta" ? "Meta" : "TikTok"}</span>
              {currentCampaign && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#9333EA]/30" />
                  <span className="text-[11px] text-[#9333EA] truncate max-w-[140px]">{currentCampaign.name}</span>
                </>
              )}
              {currentAdset && (
                <>
                  <ChevronRight className="w-3 h-3 text-[#9333EA]/30" />
                  <span className="text-[11px] text-[#9333EA] truncate max-w-[140px]">{currentAdset.name}</span>
                </>
              )}
            </div>

            {/* Mode Toggle */}
            <div>
              <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-2">入稿タイプ</label>
              <div className="flex gap-2">
                {([["existing", "既存キャンペーンに追加"], ["new", "新規作成"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => {
                      update("mode", val);
                      if (val === "existing") {
                        update("campaignId", currentCampaign?.id ?? "");
                        update("adsetId", currentAdset?.id ?? "");
                      } else {
                        update("campaignId", "");
                        update("campaignName", "");
                        update("adsetId", "");
                        update("adsetName", "");
                      }
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                      form.mode === val
                        ? "bg-[#9333EA] text-white"
                        : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset Selector (new mode only) */}
            {!isExisting && presets.length > 0 && (
              <Dropdown
                label="入稿プリセット"
                placeholder="プリセットを選択して自動入力..."
                value={form.presetId}
                onChange={(presetId) => {
                  const p = presets.find((pr) => String(pr.id) === presetId);
                  if (!p) return;
                  const presetPlacements = resolvePlacementsFromConfig(p.placementConfig);
                  const isAdvPlacement = !p.placementPresetId;
                  // Detect Advantage+ audience from preset (is_asc field mapped here)
                  const isAdvAudience = p.gender === "all" && p.ageMin === 18 && p.ageMax === 65 && !p.placementConfig;
                  setForm((prev) => ({
                    ...prev,
                    presetId,
                    advantageAudience: isAdvAudience,
                    gender: p.gender ?? prev.gender,
                    ageMin: String(p.ageMin ?? prev.ageMin),
                    ageMax: String(p.ageMax ?? prev.ageMax),
                    geoPresetId: p.geoPresetId ? String(p.geoPresetId) : prev.geoPresetId,
                    valueRuleId: p.valueRuleId ? String(p.valueRuleId) : prev.valueRuleId,
                    advantagePlacement: isAdvPlacement,
                    placements: isAdvPlacement ? [] : (presetPlacements.length > 0 ? presetPlacements : prev.placements),
                    defaultTitle: p.defaultTitle ?? prev.defaultTitle,
                    defaultBody: p.defaultBody ?? prev.defaultBody,
                    defaultDescription: p.defaultDescription ?? prev.defaultDescription,
                  }));
                }}
                renderSelected={() => {
                  const p = presets.find((pr) => String(pr.id) === form.presetId);
                  return p ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#9333EA] shrink-0" />
                      <span className="truncate">{p.presetName}</span>
                    </span>
                  ) : null;
                }}
              >
                {presets.map((p) => (
                  <DropdownItem key={p.id} value={String(p.id)} selected={form.presetId === String(p.id)}>
                    <div className="min-w-0">
                      <span className="block truncate text-[#1A1A2E]">{p.presetName}</span>
                      <span className="block truncate text-[10px] text-[#1A1A2E]/30">
                        {p.gender === "male" ? "男性" : p.gender === "female" ? "女性" : "全性別"} {p.ageMin}-{p.ageMax}歳
                      </span>
                    </div>
                  </DropdownItem>
                ))}
              </Dropdown>
            )}

            {/* Account (auto-resolved from campaign, or dropdown for new) */}
            {(() => {
              const resolvedAccount = accounts.find((a) => a.accountId === form.accountId);
              if (isExisting && form.accountId && resolvedAccount) {
                return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/[0.02] border border-black/[0.04]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[12px] text-[#1A1A2E]">{resolvedAccount.accountName}</span>
                    <span className="text-[10px] text-[#1A1A2E]/25 ml-auto">自動選択</span>
                  </div>
                );
              }
              if (!isExisting) {
                return (
                  <Section title="広告アカウント">
                    <Dropdown
                      label="アカウント"
                      required
                      placeholder="アカウントを選択..."
                      value={form.accountId}
                      onChange={(v) => {
                        const acct = accounts.find((a) => a.accountId === v);
                        setForm((prev) => ({
                          ...prev,
                          accountId: v,
                          operator: prev.operator || acct?.operatorName || "",
                        }));
                      }}
                      renderSelected={() => {
                        const a = accounts.find((a) => a.accountId === form.accountId);
                        return a ? (
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${a.isTarget ? "bg-emerald-500" : "bg-[#1A1A2E]/20"}`} />
                            <span className="truncate">{a.accountName}</span>
                          </span>
                        ) : null;
                      }}
                    >
                      {accounts.map((a) => (
                        <DropdownItem key={a.accountId} value={a.accountId} selected={form.accountId === a.accountId}>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${a.isTarget ? "bg-emerald-500" : "bg-[#1A1A2E]/20"}`} />
                          <span className="truncate">{a.accountName}</span>
                        </DropdownItem>
                      ))}
                    </Dropdown>
                  </Section>
                );
              }
              return null;
            })()}

            {/* Campaign */}
            <Section title="キャンペーン">
              {isExisting ? (
                <Dropdown
                  label="キャンペーン"
                  required
                  placeholder="キャンペーンを選択..."
                  value={form.campaignId}
                  onChange={(v) => {
                    update("campaignId", v);
                    update("adsetId", "");
                    const cpn = campaigns.find((c) => c.id === v);
                    if (cpn?.accountId) update("accountId", cpn.accountId);
                  }}
                  renderSelected={() => {
                    const c = campaigns.find((c) => c.id === form.campaignId);
                    return c ? (
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.status === "ACTIVE" ? "bg-emerald-500" : "bg-[#1A1A2E]/20"}`} />
                        <span className="truncate">{c.name}</span>
                      </span>
                    ) : null;
                  }}
                >
                  {campaigns.map((c) => (
                    <DropdownItem key={c.id} value={c.id} selected={form.campaignId === c.id}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.status === "ACTIVE" ? "bg-emerald-500" : "bg-[#1A1A2E]/20"}`} />
                      <span className="truncate">{c.name}</span>
                    </DropdownItem>
                  ))}
                </Dropdown>
              ) : (
                <>
                  <Input label="キャンペーン名" value={form.campaignName} onChange={(v) => update("campaignName", v)} required placeholder="新規キャンペーン名" />
                  <Input label="キャンペーン日予算 (¥)" value={form.budget} onChange={(v) => update("budget", v)} required placeholder="例: 50000" type="number" />
                  <div>
                    <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1.5">入札戦略</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { update("bidStrategy", "lowest_cost"); update("bidAmount", ""); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                          form.bidStrategy === "lowest_cost"
                            ? "bg-[#9333EA] text-white"
                            : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                        }`}
                      >
                        CV最大化
                      </button>
                      <button
                        onClick={() => { update("bidStrategy", "cost_cap"); update("valueRuleId", ""); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                          form.bidStrategy === "cost_cap"
                            ? "bg-[#9333EA] text-white"
                            : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                        }`}
                      >
                        目標CPA(tCPA)
                      </button>
                    </div>
                    {form.bidStrategy === "cost_cap" && (
                      <div className="mt-2">
                        <Input label="入札金額 (¥)" value={form.bidAmount} onChange={(v) => update("bidAmount", v)} placeholder="例: 3000" type="number" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </Section>

            {/* Ad Set */}
            <Section title="広告セット">
              {isExisting ? (
                <Dropdown
                  label="広告セット"
                  required
                  placeholder={form.campaignId ? "広告セットを選択..." : "先にキャンペーンを選択"}
                  value={form.adsetId}
                  onChange={(v) => update("adsetId", v)}
                  disabled={!form.campaignId}
                  renderSelected={() => {
                    const a = filteredAdsets.find((a) => a.id === form.adsetId);
                    return a ? <span className="truncate">{a.name}</span> : null;
                  }}
                >
                  {filteredAdsets.map((a) => (
                    <DropdownItem key={a.id} value={a.id} selected={form.adsetId === a.id}>
                      <span className="truncate">{a.name}</span>
                    </DropdownItem>
                  ))}
                </Dropdown>
              ) : (
                <Input label="広告セット名" value={form.adsetName} onChange={(v) => update("adsetName", v)} required placeholder="広告セット名" />
              )}
            </Section>

            {/* Creatives (CR picker) */}
            <Section title="クリエイティブ">
              {form.creatives.filter((c) => c.creativeName.trim()).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.creatives.map((cr, idx) => {
                    if (!cr.creativeName.trim()) return null;
                    return (
                      <div key={idx} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg border border-black/[0.06] bg-black/[0.01]">
                        {cr.thumbnailUrl ? (
                          <img src={cr.thumbnailUrl} alt={cr.creativeName} className="w-8 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-8 h-10 rounded bg-black/[0.04] flex items-center justify-center">
                            <Image className="w-3.5 h-3.5 text-[#1A1A2E]/20" />
                          </div>
                        )}
                        <span className="text-[11px] text-[#1A1A2E]/70 max-w-[120px] truncate">{cr.creativeName}</span>
                        <button
                          onClick={() => removeCreative(idx)}
                          className="w-4 h-4 rounded flex items-center justify-center text-[#1A1A2E]/20 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#1A1A2E]/30">CRが選択されていません</p>
              )}
              <button
                onClick={() => setShowCrPicker(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#9333EA] hover:bg-[#9333EA]/5 transition-colors border border-[#9333EA]/20"
              >
                <Plus className="w-3 h-3" />
                CR選択
              </button>
            </Section>

            {/* URL Type */}
            <Section title="入稿URL">
              <div className="flex gap-2 mb-1">
                <button
                  onClick={() => update("urlType", "articleLp")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    form.urlType === "articleLp" ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                  }`}
                >
                  記事LP URL
                </button>
                <button
                  onClick={() => update("urlType", "clickUrl")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    form.urlType === "clickUrl" ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                  }`}
                >
                  クリックURL
                </button>
              </div>

              {form.urlType === "articleLp" ? (
                articleLps.length > 0 ? (
                  <>
                    <Dropdown
                      label="記事LP"
                      placeholder="記事LPを選択..."
                      value={form.articleLpId}
                      onChange={(lpId) => {
                        const lp = articleLps.find((l) => String(l.id) === lpId);
                        setForm((prev) => ({ ...prev, articleLpId: lpId, articleLpName: lp?.name ?? "", articleLpUrl: lp?.url ?? "" }));
                      }}
                      renderSelected={() => {
                        const lp = articleLps.find((l) => String(l.id) === form.articleLpId);
                        return lp ? <span className="truncate">{lp.appealName ? `${lp.name} (${lp.appealName})` : lp.name}</span> : null;
                      }}
                    >
                      {articleLps.map((lp) => (
                        <DropdownItem key={lp.id} value={String(lp.id)} selected={form.articleLpId === String(lp.id)}>
                          <div className="min-w-0">
                            <span className="block truncate text-[#1A1A2E]">{lp.appealName ? `${lp.appealName}` : lp.name}</span>
                            <span className="block truncate text-[10px] text-[#1A1A2E]/30">{lp.name}</span>
                          </div>
                        </DropdownItem>
                      ))}
                    </Dropdown>
                    {form.articleLpUrl && (
                      <div className="px-3 py-2 rounded-lg bg-black/[0.02] border border-black/[0.04]">
                        <p className="text-[10px] text-[#1A1A2E]/35 mb-0.5">LP URL (自動設定)</p>
                        <p className="text-[12px] text-[#1A1A2E]/60 truncate">{form.articleLpUrl}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <Input label="記事LP URL" value={form.articleLpUrl} onChange={(v) => update("articleLpUrl", v)} placeholder="https://..." />
                )
              ) : (
                catsClickUrls.length > 0 ? (
                  <>
                    <Dropdown
                      label="クリックURL"
                      placeholder="クリックURLを選択..."
                      value={form.clickUrl}
                      onChange={(v) => {
                        const cc = catsClickUrls.find((c) => c.url === v);
                        setForm((prev) => ({ ...prev, clickUrl: v, articleLpName: cc?.articleLpName ?? "" }));
                      }}
                      renderSelected={() => {
                        const cc = catsClickUrls.find((c) => c.url === form.clickUrl);
                        return cc ? (
                          <span className="truncate">{cc.articleLpName ? `${cc.name} (${cc.articleLpName})` : cc.name}</span>
                        ) : form.clickUrl ? <span className="truncate">{form.clickUrl}</span> : null;
                      }}
                    >
                      {catsClickUrls.map((cc) => (
                        <DropdownItem key={cc.id} value={cc.url} selected={form.clickUrl === cc.url}>
                          <div className="min-w-0">
                            <span className="block truncate text-[#1A1A2E]">{cc.articleLpName ? `${cc.name} (${cc.articleLpName})` : cc.name}</span>
                            <span className="block truncate text-[10px] text-[#1A1A2E]/30">{cc.url}</span>
                          </div>
                        </DropdownItem>
                      ))}
                    </Dropdown>
                    {form.clickUrl && (
                      <div className="px-3 py-2 rounded-lg bg-black/[0.02] border border-black/[0.04]">
                        <p className="text-[10px] text-[#1A1A2E]/35 mb-0.5">クリックURL</p>
                        <p className="text-[12px] text-[#1A1A2E]/60 truncate">{form.clickUrl}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <Input label="クリックURL" value={form.clickUrl} onChange={(v) => update("clickUrl", v)} placeholder="https://..." />
                )
              )}
            </Section>

            {/* Targeting Settings (from preset, editable) */}
            {!isExisting && (
              <Section title={form.presetId ? `ターゲティング設定 — ${presets.find((p) => String(p.id) === form.presetId)?.presetName ?? ""}` : "ターゲティング設定"}>
                {form.presetId && (
                  <p className="text-[10px] text-[#1A1A2E]/30 -mt-1 mb-2">プリセットから自動入力済み — 個別に調整できます</p>
                )}
                {/* Audience: Advantage+ toggle */}
                <div>
                  <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1.5">オーディエンス</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => update("advantageAudience", true)}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        form.advantageAudience
                          ? "bg-[#9333EA] text-white"
                          : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      Advantage+ オーディエンス
                    </button>
                    <button
                      onClick={() => update("advantageAudience", false)}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        !form.advantageAudience
                          ? "bg-[#9333EA] text-white"
                          : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      手動設定
                    </button>
                  </div>
                  {form.advantageAudience ? (
                    <p className="text-[11px] text-[#1A1A2E]/30 px-1">Metaが年齢・性別を自動最適化します</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">性別</label>
                        <div className="flex gap-1">
                          {GENDER_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => update("gender", opt.value)}
                              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                form.gender === opt.value
                                  ? "bg-[#9333EA] text-white"
                                  : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input label="年齢（下限）" value={form.ageMin} onChange={(v) => update("ageMin", v)} type="number" placeholder="18" />
                      <Input label="年齢（上限）" value={form.ageMax} onChange={(v) => update("ageMax", v)} type="number" placeholder="65" />
                    </div>
                  )}
                </div>

                {/* Placement: Advantage+ toggle */}
                {platform === "meta" && (
                  <div>
                    <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1.5">配置</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => { update("advantagePlacement", true); update("placements", []); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                          form.advantagePlacement
                            ? "bg-[#9333EA] text-white"
                            : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                        }`}
                      >
                        Advantage+ 配置
                      </button>
                      <button
                        onClick={() => update("advantagePlacement", false)}
                        className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                          !form.advantagePlacement
                            ? "bg-[#9333EA] text-white"
                            : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                        }`}
                      >
                        手動配置
                      </button>
                    </div>
                    {form.advantagePlacement ? (
                      <p className="text-[11px] text-[#1A1A2E]/30 px-1">Metaが最もパフォーマンスの高い配置に自動最適化します</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {PLACEMENT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => togglePlacement(opt.value)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              form.placements.includes(opt.value)
                                ? "bg-[#9333EA] text-white"
                                : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Geo */}
                {geoPresets.length > 0 && (
                  <Dropdown
                    label="配信地域"
                    value={form.geoPresetId}
                    onChange={(v) => update("geoPresetId", v)}
                    placeholder="地域プリセットを選択..."
                    renderSelected={() => {
                      const g = geoPresets.find((g) => String(g.id) === form.geoPresetId);
                      return g ? <span className="truncate">{g.name}</span> : null;
                    }}
                  >
                    {geoPresets.map((g) => (
                      <DropdownItem key={g.id} value={String(g.id)} selected={form.geoPresetId === String(g.id)}>
                        <span className="truncate">{g.name}</span>
                      </DropdownItem>
                    ))}
                  </Dropdown>
                )}

                {/* Value Rule (hidden when tCPA) */}
                {valueRules.length > 0 && form.bidStrategy !== "cost_cap" && (
                  <Dropdown
                    label="バリュールール"
                    value={form.valueRuleId}
                    onChange={(v) => update("valueRuleId", v)}
                    placeholder="バリュールールを選択..."
                    renderSelected={() => {
                      const vr = valueRules.find((r) => String(r.id) === form.valueRuleId);
                      return vr ? <span className="truncate">{vr.ruleName}</span> : null;
                    }}
                  >
                    {valueRules.map((vr) => (
                      <DropdownItem key={vr.id} value={String(vr.id)} selected={form.valueRuleId === String(vr.id)}>
                        <span className="truncate">{vr.ruleName}</span>
                      </DropdownItem>
                    ))}
                  </Dropdown>
                )}
              </Section>
            )}

            {/* Ad Text (from preset, editable) */}
            {(form.defaultTitle || form.defaultBody || form.defaultDescription) && (
              <Section title="広告テキスト">
                <Input label="見出し" value={form.defaultTitle} onChange={(v) => update("defaultTitle", v)} placeholder="広告見出し" />
                <Input label="本文" value={form.defaultBody} onChange={(v) => update("defaultBody", v)} placeholder="広告本文" />
                <Input label="説明文" value={form.defaultDescription} onChange={(v) => update("defaultDescription", v)} placeholder="説明文" />
              </Section>
            )}

            {/* Schedule */}
            <Section title="配信スケジュール">
              <div className="grid grid-cols-2 gap-3">
                <Input label="開始日" value={form.startDate} onChange={(v) => update("startDate", v)} type="date" />
                <Input label="終了日" value={form.endDate} onChange={(v) => update("endDate", v)} type="date" placeholder="未設定=継続配信" />
              </div>
            </Section>

            {/* Operator */}
            <Section title="運用担当">
              <Input label="運用担当者名" value={form.operator} onChange={(v) => update("operator", v)} placeholder="例: 奥山" />
              <p className="text-[10px] text-[#1A1A2E]/30 mt-1">広告名に反映されます（パラメータ/CR名/記事名/運用担当/日付）</p>
            </Section>

            {/* Memo */}
            <Section title="メモ">
              <textarea
                value={form.memo}
                onChange={(e) => update("memo", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-black/[0.08] text-[13px] text-[#1A1A2E] bg-white placeholder:text-[#1A1A2E]/20 focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30 resize-none h-20"
                placeholder="備考・特記事項..."
              />
            </Section>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-black/[0.06] px-6 py-4 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60 hover:bg-black/[0.03] transition-colors">
            キャンセル
          </button>
          <div className="flex items-center gap-2">
            {hasCreatives && form.creatives.filter((c) => c.creativeName.trim()).length > 1 && (
              <span className="text-[11px] text-[#9333EA] font-medium">
                {form.creatives.filter((c) => c.creativeName.trim()).length}件のCR
              </span>
            )}
            <button
              onClick={async () => {
                if (!canSubmit || submitting) return;
                setSubmitting(true);
                try { await onSubmit(form); } finally { setSubmitting(false); }
              }}
              disabled={!canSubmit || submitting}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                canSubmit && !submitting
                  ? "bg-[#9333EA] text-white hover:bg-[#7E22CE]"
                  : "bg-[#1A1A2E]/[0.06] text-[#1A1A2E]/20 cursor-not-allowed"
              }`}
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {submitting ? "追加中..." : (initialData ? "更新" : "キューに追加")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Creative Picker Panel ---
type DeliveryStatus = "active" | "paused" | "not_delivered" | "not_submitted";
const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; bg: string; text: string }> = {
  active: { label: "配信中", bg: "bg-emerald-500", text: "text-white" },
  paused: { label: "停止中", bg: "bg-amber-400", text: "text-white" },
  not_delivered: { label: "未配信", bg: "bg-[#1A1A2E]/10", text: "text-[#1A1A2E]/50" },
  not_submitted: { label: "未入稿", bg: "bg-[#1A1A2E]/[0.06]", text: "text-[#1A1A2E]/30" },
};

interface CrPickerItem {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  cost: number;
  cv: number;
  cpa: number | null;
  firstDeliveryDate: string | null;
  lastDeliveryDate: string | null;
  deliveryStatus: DeliveryStatus;
}

type CrSortKey = "cost" | "cv" | "cpa" | "newest";
type CrSortDir = "desc" | "asc";

function CreativePickerPanel({ projectId, selectedCrs, onSelect, onClose }: {
  projectId: string;
  selectedCrs: CreativeEntry[];
  onSelect: (crs: CreativeEntry[]) => void;
  onClose: () => void;
}) {
  const [allCrs, setAllCrs] = useState<CrPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<CrSortKey>("cost");
  const [sortDir, setSortDir] = useState<CrSortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedCrs.map((c) => c.creativeName)));
  const [showFilters, setShowFilters] = useState(false);
  const [filterCostMin, setFilterCostMin] = useState("");
  const [filterCostMax, setFilterCostMax] = useState("");
  const [filterCvMin, setFilterCvMin] = useState("");
  const [filterCpaMax, setFilterCpaMax] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | "">("");
  const [hoveredCr, setHoveredCr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/creatives?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllCrs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = useMemo(() => {
    let list = allCrs;
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    // Filters
    if (filterCostMin) list = list.filter((c) => c.cost >= Number(filterCostMin));
    if (filterCostMax) list = list.filter((c) => c.cost <= Number(filterCostMax));
    if (filterCvMin) list = list.filter((c) => c.cv >= Number(filterCvMin));
    if (filterCpaMax) list = list.filter((c) => c.cpa !== null && c.cpa <= Number(filterCpaMax));
    if (filterDateFrom) list = list.filter((c) => c.firstDeliveryDate && c.firstDeliveryDate >= filterDateFrom);
    if (filterDateTo) list = list.filter((c) => c.lastDeliveryDate && c.lastDeliveryDate <= filterDateTo);
    if (filterStatus) list = list.filter((c) => c.deliveryStatus === filterStatus);
    // Sort
    const dir = sortDir === "desc" ? -1 : 1;
    switch (sortKey) {
      case "cost": list = [...list].sort((a, b) => (b.cost - a.cost) * dir); break;
      case "cv": list = [...list].sort((a, b) => (b.cv - a.cv) * dir); break;
      case "cpa": list = [...list].sort((a, b) => ((a.cpa ?? Infinity) - (b.cpa ?? Infinity)) * dir); break;
      case "newest": list = [...list].sort((a, b) => b.id - a.id); break;
    }
    return list;
  }, [allCrs, search, sortKey, sortDir, filterCostMin, filterCostMax, filterCvMin, filterCpaMax, filterDateFrom, filterDateTo, filterStatus]);

  const activeFilterCount = [filterCostMin, filterCostMax, filterCvMin, filterCpaMax, filterDateFrom, filterDateTo, filterStatus].filter(Boolean).length;

  const toggleCr = (cr: CrPickerItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cr.name)) next.delete(cr.name);
      else next.add(cr.name);
      return next;
    });
  };

  const handleDone = () => {
    const entries: CreativeEntry[] = Array.from(selected).map((name) => {
      const cr = allCrs.find((c) => c.name === name);
      return { creativeName: name, creativeUrl: cr?.previewUrl ?? "", thumbnailUrl: cr?.thumbnailUrl ?? null };
    });
    onSelect(entries);
    onClose();
  };

  const clearFilters = () => {
    setFilterCostMin(""); setFilterCostMax(""); setFilterCvMin(""); setFilterCpaMax(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterStatus("");
  };

  return (
    <div className="relative flex-1 bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-left duration-200 border-r border-black/[0.06]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-[14px] font-bold text-[#1A1A2E]">CR選択</h3>
          <span className="text-[11px] text-[#1A1A2E]/30">{filtered.length}件</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9333EA] font-medium">{selected.size}件選択中</span>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-black/[0.04]">
            <X className="w-3.5 h-3.5 text-[#1A1A2E]/30" />
          </button>
        </div>
      </div>
      {/* Search + Sort + Filters */}
      <div className="px-5 py-3 border-b border-black/[0.04] space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A1A2E]/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="CR名で検索..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-black/[0.08] text-[12px] text-[#1A1A2E] bg-white placeholder:text-[#1A1A2E]/20 focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["cost", "cv", "cpa", "newest"] as CrSortKey[]).map((key) => {
            const labels: Record<CrSortKey, string> = { cost: "COST", cv: "CV", cpa: "CPA", newest: "新しい順" };
            const isActive = sortKey === key;
            const displayLabel = isActive && key !== "newest" ? `${labels[key]}${sortDir === "desc" ? "降順" : "昇順"}` : labels[key];
            return (
              <button
                key={key}
                onClick={() => {
                  if (sortKey === key && key !== "newest") {
                    if (sortDir === "desc") setSortDir("asc");
                    else { setSortKey("cost"); setSortDir("desc"); }
                  } else { setSortKey(key); setSortDir("desc"); }
                }}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  isActive ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                }`}
              >
                {displayLabel}
              </button>
            );
          })}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`ml-auto px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
              showFilters || activeFilterCount > 0 ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
            }`}
          >
            フィルタ{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
        {showFilters && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">COST下限</label>
                <input type="number" value={filterCostMin} onChange={(e) => setFilterCostMin(e.target.value)} placeholder="¥0"
                  className="w-full px-2 py-1 rounded border border-black/[0.06] text-[11px] text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/20" />
              </div>
              <div>
                <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">COST上限</label>
                <input type="number" value={filterCostMax} onChange={(e) => setFilterCostMax(e.target.value)} placeholder="∞"
                  className="w-full px-2 py-1 rounded border border-black/[0.06] text-[11px] text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/20" />
              </div>
              <div>
                <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">CV下限</label>
                <input type="number" value={filterCvMin} onChange={(e) => setFilterCvMin(e.target.value)} placeholder="0"
                  className="w-full px-2 py-1 rounded border border-black/[0.06] text-[11px] text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/20" />
              </div>
              <div>
                <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">CPA上限</label>
                <input type="number" value={filterCpaMax} onChange={(e) => setFilterCpaMax(e.target.value)} placeholder="∞"
                  className="w-full px-2 py-1 rounded border border-black/[0.06] text-[11px] text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/20" />
              </div>
            </div>
            <div>
              <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">ステータス</label>
              <div className="flex gap-1">
                {(["active", "paused", "not_delivered", "not_submitted"] as DeliveryStatus[]).map((st) => {
                  const cfg = DELIVERY_STATUS_CONFIG[st];
                  return (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(filterStatus === st ? "" : st)}
                      className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                        filterStatus === st ? `${cfg.bg} ${cfg.text}` : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">配信開始日（以降）</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-black/[0.06] text-[11px] text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/20" />
              </div>
              <div>
                <label className="block text-[9px] text-[#1A1A2E]/35 mb-0.5">配信終了日（以前）</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-black/[0.06] text-[11px] text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/20" />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-[10px] text-[#9333EA] hover:underline text-left">
                フィルタをクリア
              </button>
            )}
          </div>
        )}
      </div>
      {/* CR Grid */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[#9333EA] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[12px] text-[#1A1A2E]/30 py-12">CRが見つかりません</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((cr) => {
              const isSelected = selected.has(cr.name);
              return (
                <button
                  key={cr.name}
                  onClick={() => toggleCr(cr)}
                  className={`relative text-left rounded-xl border p-2 transition-all ${
                    isSelected ? "border-[#9333EA] bg-[#9333EA]/[0.03] ring-1 ring-[#9333EA]/20" : "border-black/[0.06] hover:border-black/[0.12] bg-white"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#9333EA] flex items-center justify-center z-10">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {(() => {
                    const st = DELIVERY_STATUS_CONFIG[cr.deliveryStatus];
                    return (
                      <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold z-10 ${st.bg} ${st.text}`}>
                        {st.label}
                      </div>
                    );
                  })()}
                  <div
                    className="aspect-[9/16] w-full rounded overflow-hidden bg-black/[0.04] mb-2 relative group/thumb"
                    onClick={(e) => {
                      if (cr.previewUrl) { e.stopPropagation(); setHoveredCr(cr.previewUrl); }
                    }}
                  >
                    {cr.thumbnailUrl ? (
                      <img src={cr.thumbnailUrl} alt={cr.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-6 h-6 text-[#1A1A2E]/10" />
                      </div>
                    )}
                    {cr.previewUrl && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#1A1A2E] mb-1 break-all leading-tight">{cr.name}</p>
                  <div className="grid grid-cols-3 gap-x-1 text-[9px]">
                    <div>
                      <span className="text-[#1A1A2E]/30 block">COST</span>
                      <span className="text-[#1A1A2E]/60 font-medium">{cr.cost >= 1000 ? `¥${Math.round(cr.cost / 1000)}k` : `¥${cr.cost}`}</span>
                    </div>
                    <div>
                      <span className="text-[#1A1A2E]/30 block">CV</span>
                      <span className="text-[#1A1A2E]/60 font-medium">{cr.cv}</span>
                    </div>
                    <div>
                      <span className="text-[#1A1A2E]/30 block">CPA</span>
                      <span className="text-[#1A1A2E]/60 font-medium">{cr.cpa ? `¥${cr.cpa.toLocaleString()}` : "-"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="px-5 py-3 border-t border-black/[0.06] shrink-0">
        <button
          onClick={handleDone}
          className="w-full px-4 py-2.5 rounded-lg text-[13px] font-medium bg-[#9333EA] text-white hover:bg-[#7E22CE] transition-colors"
        >
          完了 ({selected.size}件)
        </button>
      </div>
      {hoveredCr && (
        <VideoPreviewModal previewUrl={hoveredCr} onClose={() => setHoveredCr(null)} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">
        {label}
        {required && <span className="text-[#9333EA] ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-black/[0.08] text-[13px] text-[#1A1A2E] bg-white placeholder:text-[#1A1A2E]/20 focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
      />
    </div>
  );
}

function Dropdown({ label, value, onChange, placeholder, required, disabled, children, renderSelected }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  renderSelected?: () => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">
        {label}
        {required && <span className="text-[#9333EA] ml-0.5">*</span>}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[13px] text-left transition-colors ${
          open ? "border-[#9333EA]/40 ring-1 ring-[#9333EA]/20" : "border-black/[0.08]"
        } ${disabled ? "bg-black/[0.02] text-[#1A1A2E]/20 cursor-not-allowed" : "bg-white hover:border-black/[0.12]"}`}
      >
        <span className="truncate min-w-0 flex-1">
          {value && renderSelected ? renderSelected() : <span className="text-[#1A1A2E]/25">{placeholder ?? "選択..."}</span>}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 ml-2 text-[#1A1A2E]/25 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-black/[0.08] shadow-lg max-h-[280px] overflow-y-auto">
          <div className="py-1" onClick={(e) => {
            const item = (e.target as HTMLElement).closest("[data-value]");
            if (item) {
              onChange(item.getAttribute("data-value")!);
              setOpen(false);
            }
          }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ value, selected, children }: {
  value: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-value={value}
      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-[13px] ${
        selected ? "bg-[#9333EA]/[0.04] text-[#9333EA]" : "text-[#1A1A2E]/70 hover:bg-black/[0.02]"
      }`}
    >
      {children}
      {selected && <Check className="w-3.5 h-3.5 shrink-0 ml-auto text-[#9333EA]" />}
    </div>
  );
}

// --- Preset helpers ---
/** Resolve placement config JSONB → UI placement values */
function resolvePlacementsFromConfig(config: Record<string, unknown> | null | undefined): string[] {
  if (!config) return [];
  const result: string[] = [];
  const fbPos = (config.facebook_positions as string[]) ?? [];
  const igPos = (config.instagram_positions as string[]) ?? [];
  const pubs = (config.publisher_platforms as string[]) ?? [];
  // IG
  if (igPos.some((p) => p === "reels" || p === "instagram_reels")) result.push("ig_reels");
  if (igPos.some((p) => p === "stream" || p === "feed")) result.push("ig_feed");
  if (igPos.some((p) => p === "story" || p === "instagram_stories")) result.push("ig_stories");
  if (igPos.some((p) => p === "instagram_explore" || p === "instagram_explore_grid_home")) result.push("ig_other");
  // FB
  if (fbPos.some((p) => p === "reels" || p === "facebook_reels" || p === "facebook_reels_overlay")) result.push("fb_reels");
  if (fbPos.some((p) => p === "feed")) result.push("fb_feed");
  if (fbPos.some((p) => p === "story" || p === "facebook_stories")) result.push("fb_stories");
  if (fbPos.some((p) => p === "marketplace" || p === "search" || p === "instream_video")) result.push("fb_other");
  if (pubs.includes("audience_network")) result.push("audience_network");
  return result;
}
function mapPreset(p: Record<string, unknown>): PresetOption {
  return {
    id: p.id as number,
    presetName: (p.presetName ?? p.preset_name ?? "") as string,
    gender: (p.gender ?? "all") as string,
    ageMin: (p.ageMin ?? p.age_min ?? 18) as number,
    ageMax: (p.ageMax ?? p.age_max ?? 65) as number,
    defaultTitle: (p.defaultTitle ?? p.default_title ?? null) as string | null,
    defaultBody: (p.defaultBody ?? p.default_body ?? null) as string | null,
    defaultDescription: (p.defaultDescription ?? p.default_description ?? null) as string | null,
    geoPresetId: (p.geoPresetId ?? p.geo_preset_id ?? null) as number | null,
    valueRuleId: (p.valueRuleId ?? p.value_rule_id ?? null) as number | null,
    placementPresetId: (p.placementPresetId ?? p.placement_preset_id ?? null) as number | null,
    placementConfig: (p.placementConfig ?? p.placement_config ?? null) as Record<string, unknown> | null,
  };
}

// --- Preset Settings Panel ---

interface PresetForm {
  presetName: string;
  advantageAudience: boolean;
  gender: string;
  ageMin: string;
  ageMax: string;
  advantagePlacement: boolean;
  placements: string[];
  geoPresetId: string;
  valueRuleId: string;
  defaultTitle: string;
  defaultBody: string;
  defaultDescription: string;
}

const emptyPresetForm: PresetForm = {
  presetName: "",
  advantageAudience: false, gender: "all", ageMin: "18", ageMax: "65",
  advantagePlacement: true, placements: [],
  geoPresetId: "", valueRuleId: "",
  defaultTitle: "", defaultBody: "", defaultDescription: "",
};

function PresetSettingsPanel({ projectId, platform, onClose }: {
  projectId: string | number;
  platform: Platform;
  onClose: () => void;
}) {
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [geoPresets, setGeoPresets] = useState<GeoPresetOption[]>([]);
  const [valueRules, setValueRules] = useState<ValueRuleOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PresetForm>(emptyPresetForm);

  // Fetch presets and options
  useEffect(() => {
    Promise.all([
      fetch(`/api/operations/presets?projectId=${projectId}`).then((r) => r.json()),
      fetch(`/api/operations/form-options?projectId=${projectId}&platform=${platform}`).then((r) => r.json()),
    ]).then(([presetsData, optionsData]) => {
      const rawPresets = Array.isArray(presetsData) ? presetsData : [];
      setPresets(rawPresets.map(mapPreset));
      setGeoPresets(optionsData.geoPresets ?? []);
      setValueRules(optionsData.valueRules ?? []);
      setAccounts(optionsData.accounts ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId, platform]);

  const updateForm = (key: keyof PresetForm, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  function startEdit(preset: PresetOption) {
    setEditingId(preset.id);
    const resolvedPlacements = resolvePlacementsFromConfig(preset.placementConfig);
    const isAdvPlacement = !preset.placementPresetId; // no placement preset = Advantage+
    const isAdvAudience = preset.gender === "all" && preset.ageMin === 18 && preset.ageMax === 65 && !preset.placementConfig;
    setForm({
      presetName: preset.presetName,
      advantageAudience: isAdvAudience,
      gender: preset.gender,
      ageMin: String(preset.ageMin),
      ageMax: String(preset.ageMax),
      advantagePlacement: isAdvPlacement,
      placements: resolvedPlacements,
      geoPresetId: preset.geoPresetId ? String(preset.geoPresetId) : "",
      valueRuleId: preset.valueRuleId ? String(preset.valueRuleId) : "",
      defaultTitle: preset.defaultTitle ?? "",
      defaultBody: preset.defaultBody ?? "",
      defaultDescription: preset.defaultDescription ?? "",
    });
  }

  function startNew() {
    setEditingId(0); // 0 = new
    setForm(emptyPresetForm);
  }

  async function savePreset() {
    if (!form.presetName.trim()) return;
    setSaving(true);
    const body = {
      projectId: Number(projectId),
      presetName: form.presetName,
      campaignObjective: "OUTCOME_SALES",
      optimizationGoal: "OFFSITE_CONVERSIONS",
      customEventType: "PURCHASE",
      isAsc: form.advantageAudience,
      gender: form.advantageAudience ? "all" : form.gender,
      ageMin: form.advantageAudience ? 18 : (Number(form.ageMin) || 18),
      ageMax: form.advantageAudience ? 65 : (Number(form.ageMax) || 65),
      geoPresetId: form.geoPresetId ? Number(form.geoPresetId) : null,
      valueRuleId: form.valueRuleId ? Number(form.valueRuleId) : null,
      advantagePlacement: form.advantagePlacement,
      placements: form.advantagePlacement ? [] : form.placements,
      defaultTitle: form.defaultTitle || null,
      defaultBody: form.defaultBody || null,
      defaultDescription: form.defaultDescription || null,
    };

    const method = editingId && editingId > 0 ? "PUT" : "POST";
    const payload = method === "PUT" ? { id: editingId, ...body } : body;

    try {
      const res = await fetch("/api/operations/presets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.error) {
        // Refresh presets
        const refreshed = await fetch(`/api/operations/presets?projectId=${projectId}`).then((r) => r.json());
        setPresets(Array.isArray(refreshed) ? refreshed.map(mapPreset) : []);
        setEditingId(null);
        setForm(emptyPresetForm);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function deletePreset(id: number) {
    await fetch(`/api/operations/presets?id=${id}`, { method: "DELETE" });
    setPresets((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) { setEditingId(null); setForm(emptyPresetForm); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-black/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A2E]/[0.06] flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#1A1A2E]/50" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1A1A2E]">入稿デフォルト設定</h2>
              <p className="text-[11px] text-[#1A1A2E]/35">プリセットを管理</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors">
            <X className="w-4 h-4 text-[#1A1A2E]/40" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-[#9333EA] animate-spin" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Existing Presets */}
            {presets.length > 0 && editingId === null && (
              <div className="space-y-2">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-black/[0.06] hover:border-[#9333EA]/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A2E] truncate">{p.presetName}</p>
                      <p className="text-[10px] text-[#1A1A2E]/30">
                        {p.gender === "male" ? "男性" : p.gender === "female" ? "女性" : "全性別"} {p.ageMin}-{p.ageMax}歳
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#9333EA] hover:bg-[#9333EA]/5 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deletePreset(p.id)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[#1A1A2E]/20 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editingId === null && (
              <button
                onClick={startNew}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#9333EA] hover:bg-[#9333EA]/5 transition-colors w-full justify-center border border-dashed border-[#9333EA]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                新規プリセット
              </button>
            )}

            {/* Edit Form */}
            {editingId !== null && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-[#1A1A2E]">
                    {editingId === 0 ? "新規プリセット" : "プリセット編集"}
                  </h3>
                  <button
                    onClick={() => { setEditingId(null); setForm(emptyPresetForm); }}
                    className="text-[11px] text-[#1A1A2E]/30 hover:text-[#1A1A2E]/60"
                  >
                    キャンセル
                  </button>
                </div>

                <Input label="プリセット名" value={form.presetName} onChange={(v) => updateForm("presetName", v)} required placeholder="例: REDEN標準設定" />

                <Section title="オーディエンス">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setForm((p) => ({ ...p, advantageAudience: true }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        form.advantageAudience ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      Advantage+
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, advantageAudience: false }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        !form.advantageAudience ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      手動設定
                    </button>
                  </div>
                  {!form.advantageAudience && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#1A1A2E]/50 mb-1">性別</label>
                        <div className="flex gap-1">
                          {GENDER_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updateForm("gender", opt.value)}
                              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                form.gender === opt.value ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input label="年齢（下限）" value={form.ageMin} onChange={(v) => updateForm("ageMin", v)} type="number" placeholder="18" />
                      <Input label="年齢（上限）" value={form.ageMax} onChange={(v) => updateForm("ageMax", v)} type="number" placeholder="65" />
                    </div>
                  )}
                </Section>

                <Section title="配置">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setForm((p) => ({ ...p, advantagePlacement: true, placements: [] }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        form.advantagePlacement ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      Advantage+
                    </button>
                    <button
                      onClick={() => setForm((p) => ({ ...p, advantagePlacement: false }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        !form.advantagePlacement ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                      }`}
                    >
                      手動配置
                    </button>
                  </div>
                  {!form.advantagePlacement && (
                    <div className="flex flex-wrap gap-1.5">
                      {PLACEMENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setForm((prev) => ({
                            ...prev,
                            placements: prev.placements.includes(opt.value)
                              ? prev.placements.filter((p) => p !== opt.value)
                              : [...prev.placements, opt.value],
                          }))}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            form.placements.includes(opt.value) ? "bg-[#9333EA] text-white" : "bg-black/[0.03] text-[#1A1A2E]/40 hover:bg-black/[0.06]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Geo Targeting */}
                <Section title="配信地域">
                  {geoPresets.length > 0 ? (
                    <Dropdown
                      label="地域プリセット"
                      value={form.geoPresetId}
                      onChange={(v) => updateForm("geoPresetId", v)}
                      placeholder="地域プリセットを選択..."
                      renderSelected={() => {
                        const g = geoPresets.find((g) => String(g.id) === form.geoPresetId);
                        return g ? <span className="truncate">{g.name}</span> : null;
                      }}
                    >
                      {geoPresets.map((g) => (
                        <DropdownItem key={g.id} value={String(g.id)} selected={form.geoPresetId === String(g.id)}>
                          <div className="min-w-0">
                            <span className="block truncate text-[#1A1A2E]">{g.name}</span>
                            {Array.isArray(g.config?.countries) && (
                              <span className="block truncate text-[10px] text-[#1A1A2E]/30">
                                {(g.config.countries as string[]).join(", ")}
                              </span>
                            )}
                          </div>
                        </DropdownItem>
                      ))}
                    </Dropdown>
                  ) : (
                    <p className="text-[12px] text-[#1A1A2E]/30">地域プリセット未登録</p>
                  )}
                </Section>

                {/* Value Rules */}
                {valueRules.length > 0 && (
                  <Section title="バリュールール">
                    <Dropdown
                      label="バリュールール"
                      value={form.valueRuleId}
                      onChange={(v) => updateForm("valueRuleId", v)}
                      placeholder="バリュールールを選択..."
                      renderSelected={() => {
                        const vr = valueRules.find((r) => String(r.id) === form.valueRuleId);
                        return vr ? <span className="truncate">{vr.ruleName}</span> : null;
                      }}
                    >
                      {valueRules.map((vr) => (
                        <DropdownItem key={vr.id} value={String(vr.id)} selected={form.valueRuleId === String(vr.id)}>
                          <div className="min-w-0">
                            <span className="block truncate text-[#1A1A2E]">{vr.ruleName}</span>
                            <span className="block truncate text-[10px] text-[#1A1A2E]/30">
                              {accounts.find((a) => a.accountId === vr.accountId)?.accountName ?? vr.accountId}
                            </span>
                          </div>
                        </DropdownItem>
                      ))}
                    </Dropdown>
                  </Section>
                )}

                <Section title="広告デフォルト">
                  <Input label="デフォルトタイトル" value={form.defaultTitle} onChange={(v) => updateForm("defaultTitle", v)} placeholder="広告タイトル" />
                  <Input label="デフォルト本文" value={form.defaultBody} onChange={(v) => updateForm("defaultBody", v)} placeholder="広告本文" />
                  <Input label="デフォルト説明文" value={form.defaultDescription} onChange={(v) => updateForm("defaultDescription", v)} placeholder="説明文" />
                </Section>

                <button
                  onClick={savePreset}
                  disabled={saving || !form.presetName.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                    form.presetName.trim() && !saving
                      ? "bg-[#9333EA] text-white hover:bg-[#7E22CE]"
                      : "bg-[#1A1A2E]/[0.06] text-[#1A1A2E]/20 cursor-not-allowed"
                  }`}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingId === 0 ? "作成" : "保存"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
