"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Search, Filter, ChevronLeft, ChevronRight, Loader2, Play, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { useProject } from "@/components/providers/project-provider";
import { VideoPreviewModal } from "@/components/video-preview-modal";

interface Creative {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  cost: number;
  cv: number;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
  mcvr: number | null;
  mcpa: number | null;
  lpcvr: number | null;
  cvr: number | null;
  firstDeliveryDate: string | null;
  lastDeliveryDate: string | null;
  platform: string;
}

type SortKey = "name" | "cost" | "cv" | "cpa" | "ctr" | "cpc" | "mcvr" | "mcpa" | "lpcvr" | "cvr" | "date";
type SortDir = "asc" | "desc";

const METRIC_KEYS = ["cost", "cv", "cpa", "ctr", "cpc", "mcvr", "mcpa", "lpcvr", "cvr"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

interface MetricFilter { key: MetricKey; min: string; max: string }
interface DateFilter { from: string; to: string }

function fmt(v: number | null, prefix = "", suffix = ""): string {
  if (v === null || v === undefined) return "-";
  return `${prefix}${v.toLocaleString()}${suffix}`;
}

function getSortValue(row: Creative, key: SortKey): number | string {
  switch (key) {
    case "name": return row.name;
    case "cost": return row.cost;
    case "cv": return row.cv;
    case "cpa": return row.cpa ?? -1;
    case "ctr": return row.ctr ?? -1;
    case "cpc": return row.cpc ?? -1;
    case "mcvr": return row.mcvr ?? -1;
    case "mcpa": return row.mcpa ?? -1;
    case "lpcvr": return row.lpcvr ?? -1;
    case "cvr": return row.cvr ?? -1;
    case "date": return row.firstDeliveryDate ?? "";
  }
}

function getMetricValue(row: Creative, key: MetricKey): number | null {
  return row[key] as number | null;
}

// --- Filter Panel Component ---
const PLACEMENT_OPTIONS = [
  { key: "all", label: "全配置" },
  { key: "ig_reels", label: "IG Reels" },
  { key: "ig_feed", label: "IG Feed" },
  { key: "ig_stories", label: "IG Stories" },
  { key: "ig_other", label: "IG その他" },
  { key: "fb_reels", label: "FB Reels" },
  { key: "fb_feed", label: "FB Feed" },
  { key: "fb_stories", label: "FB Stories" },
  { key: "fb_other", label: "FB その他" },
  { key: "audience_network", label: "Audience Network" },
] as const;

function FilterPanel({
  metricFilters, setMetricFilters,
  platformFilter, setPlatformFilter,
  placementFilter, setPlacementFilter,
  firstDateFilter, setFirstDateFilter,
  deliveryDateFilter, setDeliveryDateFilter,
  onClose,
}: {
  metricFilters: MetricFilter[];
  setMetricFilters: (f: MetricFilter[]) => void;
  platformFilter: string;
  setPlatformFilter: (p: string) => void;
  placementFilter: string;
  setPlacementFilter: (p: string) => void;
  firstDateFilter: DateFilter;
  setFirstDateFilter: (f: DateFilter) => void;
  deliveryDateFilter: DateFilter;
  setDeliveryDateFilter: (f: DateFilter) => void;
  onClose: () => void;
}) {
  function addMetricFilter() {
    setMetricFilters([...metricFilters, { key: "cost", min: "", max: "" }]);
  }
  function removeMetricFilter(i: number) {
    setMetricFilters(metricFilters.filter((_, idx) => idx !== i));
  }
  function updateMetricFilter(i: number, patch: Partial<MetricFilter>) {
    setMetricFilters(metricFilters.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }

  return (
    <div className="content-card rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1A1A2E]">フィルター</h3>
        <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-black/[0.04] flex items-center justify-center">
          <X className="w-4 h-4 text-[#1A1A2E]/40" />
        </button>
      </div>

      {/* Platform */}
      <div>
        <p className="text-[12px] font-semibold text-[#1A1A2E]/40 mb-2">媒体</p>
        <div className="flex gap-2">
          {["all", "meta", "tiktok"].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                platformFilter === p ? "bg-[#9333EA] text-white" : "bg-[#1A1A2E]/[0.04] text-[#1A1A2E]/50 hover:bg-[#1A1A2E]/[0.08]"
              }`}
            >
              {p === "all" ? "すべて" : p === "meta" ? "Meta" : "TikTok"}
            </button>
          ))}
        </div>
      </div>

      {/* Placement (Meta only) */}
      {platformFilter !== "tiktok" && (
        <div>
          <p className="text-[12px] font-semibold text-[#1A1A2E]/40 mb-2">配置（Meta）</p>
          <div className="flex flex-wrap gap-1.5">
            {PLACEMENT_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlacementFilter(p.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  placementFilter === p.key ? "bg-[#9333EA] text-white" : "bg-[#1A1A2E]/[0.04] text-[#1A1A2E]/50 hover:bg-[#1A1A2E]/[0.08]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* First delivery date filter */}
      <div>
        <p className="text-[12px] font-semibold text-[#1A1A2E]/40 mb-2">初回配信日</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={firstDateFilter.from}
            onChange={(e) => setFirstDateFilter({ ...firstDateFilter, from: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
          />
          <span className="text-[11px] text-[#1A1A2E]/30">〜</span>
          <input
            type="date"
            value={firstDateFilter.to}
            onChange={(e) => setFirstDateFilter({ ...firstDateFilter, to: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
          />
          {(firstDateFilter.from || firstDateFilter.to) && (
            <button onClick={() => setFirstDateFilter({ from: "", to: "" })} className="w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Delivery period filter */}
      <div>
        <p className="text-[12px] font-semibold text-[#1A1A2E]/40 mb-2">配信期間（この期間に配信実績があるCRに絞る）</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={deliveryDateFilter.from}
            onChange={(e) => setDeliveryDateFilter({ ...deliveryDateFilter, from: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
          />
          <span className="text-[11px] text-[#1A1A2E]/30">〜</span>
          <input
            type="date"
            value={deliveryDateFilter.to}
            onChange={(e) => setDeliveryDateFilter({ ...deliveryDateFilter, to: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
          />
          {(deliveryDateFilter.from || deliveryDateFilter.to) && (
            <button onClick={() => setDeliveryDateFilter({ from: "", to: "" })} className="w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Metric filters */}
      <div>
        <p className="text-[12px] font-semibold text-[#1A1A2E]/40 mb-2">指標フィルター</p>
        <div className="space-y-2">
          {metricFilters.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={f.key}
                onChange={(e) => updateMetricFilter(i, { key: e.target.value as MetricKey })}
                className="px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
              >
                {METRIC_KEYS.map((k) => (
                  <option key={k} value={k}>{k.toUpperCase()}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="最小"
                value={f.min}
                onChange={(e) => updateMetricFilter(i, { min: e.target.value })}
                className="w-24 px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] placeholder:text-[#1A1A2E]/25 focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
              />
              <span className="text-[11px] text-[#1A1A2E]/30">〜</span>
              <input
                type="number"
                placeholder="最大"
                value={f.max}
                onChange={(e) => updateMetricFilter(i, { max: e.target.value })}
                className="w-24 px-2 py-1.5 rounded-lg border border-black/[0.08] text-[12px] bg-white text-[#1A1A2E] placeholder:text-[#1A1A2E]/25 focus:outline-none focus:ring-1 focus:ring-[#9333EA]/30"
              />
              <button onClick={() => removeMetricFilter(i)} className="w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addMetricFilter}
          className="mt-2 text-[12px] text-[#9333EA] font-medium hover:opacity-70 transition-opacity"
        >
          + 条件を追加
        </button>
      </div>
    </div>
  );
}

// --- Main Component ---
export default function CreativesPage() {
  const { currentProject } = useProject();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilter, setShowFilter] = useState(false);
  const [metricFilters, setMetricFilters] = useState<MetricFilter[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [placementFilter, setPlacementFilter] = useState("all");
  const [firstDateFilter, setFirstDateFilter] = useState<DateFilter>({ from: "", to: "" });
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<DateFilter>({ from: "", to: "" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    let url = `/api/creatives?projectId=${currentProject.id}`;
    if (placementFilter !== "all") url += `&placement=${placementFilter}`;
    if (deliveryDateFilter.from) url += `&from=${deliveryDateFilter.from}`;
    if (deliveryDateFilter.to) url += `&to=${deliveryDateFilter.to}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setCreatives(Array.isArray(data) ? data : []))
      .catch(() => setCreatives([]))
      .finally(() => setLoading(false));
  }, [currentProject.id, placementFilter, deliveryDateFilter.from, deliveryDateFilter.to]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const activeFilterCount =
    metricFilters.length
    + (platformFilter !== "all" ? 1 : 0)
    + (placementFilter !== "all" ? 1 : 0)
    + (firstDateFilter.from || firstDateFilter.to ? 1 : 0)
    + (deliveryDateFilter.from || deliveryDateFilter.to ? 1 : 0);

  const filtered = useMemo(() => {
    let result = creatives;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    // Platform
    if (platformFilter !== "all") {
      result = result.filter((c) => c.platform === platformFilter);
    }

    // First delivery date filter
    if (firstDateFilter.from) {
      result = result.filter((c) => c.firstDeliveryDate && c.firstDeliveryDate >= firstDateFilter.from);
    }
    if (firstDateFilter.to) {
      result = result.filter((c) => c.firstDeliveryDate && c.firstDeliveryDate <= firstDateFilter.to);
    }

    // Delivery period filter — API already filters metrics by date range,
    // but CRs with no data in that period (cost=0) should be hidden
    if (deliveryDateFilter.from || deliveryDateFilter.to) {
      result = result.filter((c) => c.cost > 0);
    }

    // Metric filters
    for (const f of metricFilters) {
      const minVal = f.min !== "" ? Number(f.min) : null;
      const maxVal = f.max !== "" ? Number(f.max) : null;
      if (minVal === null && maxVal === null) continue;
      result = result.filter((c) => {
        const v = getMetricValue(c, f.key);
        if (v === null) return false;
        if (minVal !== null && v < minVal) return false;
        if (maxVal !== null && v > maxVal) return false;
        return true;
      });
    }

    return result;
  }, [creatives, searchQuery, platformFilter, firstDateFilter, deliveryDateFilter, metricFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, sortKey, sortDir]);

  // Weighted averages for CV>0 creatives
  const avgRow = useMemo(() => {
    const withCv = sorted.filter((c) => c.cv > 0);
    if (withCv.length === 0) return null;
    const n = withCv.length;
    const totalCost = withCv.reduce((s, c) => s + c.cost, 0);
    const totalCv = withCv.reduce((s, c) => s + c.cv, 0);
    const totalClicks = withCv.reduce((s, c) => {
      // Reverse CPC to get clicks: clicks = cost / cpc
      if (c.cpc && c.cpc > 0) return s + Math.round(c.cost / c.cpc);
      return s;
    }, 0);
    const totalImp = withCv.reduce((s, c) => {
      // Reverse CTR to get impressions: imp = clicks / (ctr/100)
      if (c.ctr && c.ctr > 0 && c.cpc && c.cpc > 0) {
        const clicks = Math.round(c.cost / c.cpc);
        return s + Math.round(clicks / (c.ctr / 100));
      }
      return s;
    }, 0);
    const totalMcv = withCv.reduce((s, c) => {
      if (c.mcpa && c.mcpa > 0) return s + Math.round(c.cost / c.mcpa);
      return s;
    }, 0);

    return {
      count: n,
      cost: Math.round(totalCost / n),
      cv: Math.round(totalCv / n * 100) / 100,
      cpa: totalCv > 0 ? Math.round(totalCost / totalCv) : null,
      ctr: totalImp > 0 ? Math.round((totalClicks / totalImp) * 10000) / 100 : null,
      cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : null,
      mcvr: totalClicks > 0 ? Math.round((totalMcv / totalClicks) * 10000) / 100 : null,
      mcpa: totalMcv > 0 ? Math.round(totalCost / totalMcv) : null,
      lpcvr: totalMcv > 0 ? Math.round((totalCv / totalMcv) * 10000) / 100 : null,
      cvr: totalClicks > 0 ? Math.round((totalCv / totalClicks) * 10000) / 100 : null,
    };
  }, [sorted]);

  const RANKING_PERIODS = [
    { key: "7d", label: "過去7日", days: 7 },
    { key: "30d", label: "過去30日", days: 30 },
    { key: "90d", label: "過去90日", days: 90 },
    { key: "all", label: "全期間", days: 0 },
  ] as const;
  type RankingPeriod = (typeof RANKING_PERIODS)[number]["key"];
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("all");
  const [rankingData, setRankingData] = useState<Creative[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  // Fetch ranking data with period-specific metrics
  useEffect(() => {
    const period = RANKING_PERIODS.find((p) => p.key === rankingPeriod)!;
    let url = `/api/creatives?projectId=${currentProject.id}`;
    if (period.days > 0) {
      const from = new Date(Date.now() - period.days * 86400000).toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      url += `&from=${from}&to=${to}`;
    }
    if (placementFilter !== "all") url += `&placement=${placementFilter}`;
    setRankingLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => setRankingData(Array.isArray(data) ? data : []))
      .catch(() => setRankingData([]))
      .finally(() => setRankingLoading(false));
  }, [currentProject.id, rankingPeriod, placementFilter]);

  const allRanking = useMemo(() => {
    // Apply same filters as main table to ranking data
    let base = rankingData;
    if (platformFilter !== "all") base = base.filter((c) => c.platform === platformFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((c) => c.name.toLowerCase().includes(q));
    }
    return [...base].sort((a, b) => b.cv - a.cv).filter((c) => c.cv > 0);
  }, [rankingData, platformFilter, searchQuery]);

  const [rankingPage, setRankingPage] = useState(0);
  const PAGE_SIZE = 5;
  const maxPage = Math.max(0, Math.ceil(allRanking.length / PAGE_SIZE) - 1);
  const ranking = allRanking.slice(rankingPage * PAGE_SIZE, (rankingPage + 1) * PAGE_SIZE);

  // Reset page when data/period change
  useEffect(() => { setRankingPage(0); }, [allRanking]);

  const columns: { key: SortKey | "thumb"; label: string; align: "left" | "right"; sortable: boolean }[] = [
    { key: "thumb", label: "サムネイル", align: "left", sortable: false },
    { key: "name", label: "タイトル", align: "left", sortable: true },
    { key: "cost", label: "COST", align: "right", sortable: true },
    { key: "cv", label: "CV", align: "right", sortable: true },
    { key: "cpa", label: "CPA", align: "right", sortable: true },
    { key: "ctr", label: "CTR", align: "right", sortable: true },
    { key: "cpc", label: "CPC", align: "right", sortable: true },
    { key: "mcvr", label: "MCVR", align: "right", sortable: true },
    { key: "mcpa", label: "MCPA", align: "right", sortable: true },
    { key: "lpcvr", label: "LPCVR", align: "right", sortable: true },
    { key: "cvr", label: "CVR", align: "right", sortable: true },
    { key: "date", label: "初回配信日", align: "right", sortable: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">クリエイティブ</h1>
        <p className="text-sm text-[#1A1A2E]/40 mt-0.5">
          {currentProject.name} — {filtered.length} / {creatives.length} 件表示
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#9333EA] animate-spin" />
        </div>
      ) : (
        <>
          {/* Ranking */}
          <div className="content-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-[#1A1A2E]">
                  CVランキング
                  {allRanking.length > 0 && (
                    <span className="ml-2 text-[11px] font-normal text-[#1A1A2E]/30">
                      {rankingPage * PAGE_SIZE + 1}–{Math.min((rankingPage + 1) * PAGE_SIZE, allRanking.length)} / {allRanking.length}
                    </span>
                  )}
                </h2>
                <div className="flex gap-1">
                  {RANKING_PERIODS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setRankingPeriod(p.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        rankingPeriod === p.key
                          ? "bg-[#9333EA]/10 text-[#9333EA]"
                          : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50 hover:bg-black/[0.02]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {rankingPage > 0 && (
                  <button
                    onClick={() => setRankingPage(rankingPage - 1)}
                    className="w-7 h-7 rounded-lg border border-black/[0.06] flex items-center justify-center hover:bg-black/[0.02]"
                  >
                    <ChevronLeft className="w-4 h-4 text-[#1A1A2E]/40" />
                  </button>
                )}
                {rankingPage < maxPage && (
                  <button
                    onClick={() => setRankingPage(rankingPage + 1)}
                    className="w-7 h-7 rounded-lg border border-black/[0.06] flex items-center justify-center hover:bg-black/[0.02]"
                  >
                    <ChevronRight className="w-4 h-4 text-[#1A1A2E]/40" />
                  </button>
                )}
              </div>
            </div>
            {rankingLoading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#9333EA] animate-spin" />
              </div>
            ) : ranking.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#1A1A2E]/30">データがありません</div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(ranking.length, 5)}, 1fr)` }}>
                {ranking.map((item, i) => (
                  <div key={item.id} className="rounded-xl border border-black/[0.06] overflow-hidden hover:shadow-md transition-all cursor-pointer"
                    onClick={() => item.previewUrl && setPreviewUrl(item.previewUrl)}>
                    <div className="aspect-[9/16] bg-[#1A1A2E]/[0.03] relative group">
                      {item.thumbnailUrl && (
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )}
                      {item.previewUrl && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 w-6 h-6 rounded-full gradient-warm text-white text-[11px] font-bold flex items-center justify-center">{rankingPage * PAGE_SIZE + i + 1}</span>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[12px] font-medium text-[#1A1A2E] truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-[#9333EA]">{item.cv} CV</span>
                        <span className="text-[11px] text-[#1A1A2E]/30">CPA {fmt(item.cpa, "¥")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search + Filter toggle */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A2E]/30" />
              <input
                type="text"
                placeholder="クリエイティブを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/30 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                showFilter || activeFilterCount > 0
                  ? "border-[#9333EA]/30 bg-[#9333EA]/5 text-[#9333EA]"
                  : "border-black/[0.08] bg-white text-[#1A1A2E]/60 hover:bg-black/[0.02]"
              }`}
            >
              <Filter className="w-4 h-4" />
              フィルター
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#9333EA] text-white text-[11px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilter && (
            <FilterPanel
              metricFilters={metricFilters}
              setMetricFilters={setMetricFilters}
              platformFilter={platformFilter}
              setPlatformFilter={setPlatformFilter}
              placementFilter={placementFilter}
              setPlacementFilter={setPlacementFilter}
              firstDateFilter={firstDateFilter}
              setFirstDateFilter={setFirstDateFilter}
              deliveryDateFilter={deliveryDateFilter}
              setDeliveryDateFilter={setDeliveryDateFilter}
              onClose={() => setShowFilter(false)}
            />
          )}

          {/* Table */}
          <div className="content-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-black/[0.04]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`${col.align === "right" ? "text-right" : "text-left"} px-3 py-3 text-[12px] font-semibold whitespace-nowrap ${
                        col.sortable ? "cursor-pointer select-none hover:text-[#9333EA] transition-colors" : ""
                      } ${sortKey === col.key ? "text-[#9333EA]" : "text-[#1A1A2E]/35"}`}
                      onClick={() => col.sortable && col.key !== "thumb" && handleSort(col.key as SortKey)}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                        {col.label}
                        {col.sortable && (
                          sortKey === col.key ? (
                            sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {avgRow && (
                <tbody>
                  <tr className="bg-[#9333EA]/[0.03] border-b-2 border-[#9333EA]/10">
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-[#9333EA]">
                      平均（CV有 {avgRow.count}件）
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.cost, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]">{avgRow.cv.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.cpa, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.ctr, "", "%")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.cpc, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.mcvr, "", "%")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.mcpa, "¥")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.lpcvr, "", "%")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#9333EA]/70">{fmt(avgRow.cvr, "", "%")}</td>
                    <td className="px-3 py-2.5" />
                  </tr>
                </tbody>
              )}
              <tbody className="divide-y divide-black/[0.03]">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-[#1A1A2E]/30">
                      {creatives.length > 0 ? "フィルター条件に一致するデータがありません" : "データがありません"}
                    </td>
                  </tr>
                ) : (
                  sorted.map((row) => (
                    <tr key={row.id} className="hover:bg-black/[0.01] transition-colors">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => row.previewUrl && setPreviewUrl(row.previewUrl)}
                          className={`w-20 h-14 rounded-lg overflow-hidden bg-[#1A1A2E]/[0.04] ${row.previewUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                        >
                          {row.thumbnailUrl ? (
                            <img src={row.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-[13px] font-medium text-[#1A1A2E] max-w-[220px] truncate">{row.name}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(Math.round(row.cost), "¥")}</td>
                      <td className="px-3 py-2 text-right text-[13px] font-bold text-[#1A1A2E]">{row.cv}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.cpa, "¥")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.ctr, "", "%")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.cpc, "¥")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.mcvr, "", "%")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.mcpa, "¥")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.lpcvr, "", "%")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/60">{fmt(row.cvr, "", "%")}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-[#1A1A2E]/30 whitespace-nowrap">{row.firstDeliveryDate ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {previewUrl && (
        <VideoPreviewModal previewUrl={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}
