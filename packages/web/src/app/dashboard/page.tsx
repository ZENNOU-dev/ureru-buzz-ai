"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Target,
  BarChart3, ArrowUpRight, MousePointerClick, Loader2, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useProject } from "@/components/providers/project-provider";
import { VideoPreviewModal } from "@/components/video-preview-modal";

interface KpiBlock {
  cv: number; spend: number; cpa: number; ctr: number;
  cvChange: number; spendChange: number; cpaChange: number; ctrChange: number;
}
interface DailyPoint { date: string; cv: number; spend: number }
interface DashboardData { monthly: KpiBlock; weekly: KpiBlock; daily: DailyPoint[] }
interface TopCreative { creativeName: string; cv: number; cpa: string; thumbnailUrl: string | null; previewUrl: string | null }

function buildMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const l = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    opts.push({ value: v, label: l });
  }
  return opts;
}

function KpiCard({ label, value, change, up, gradient, icon: Icon }: {
  label: string; value: string; change: number; up: boolean; gradient: string; icon: React.ElementType;
}) {
  return (
    <div className="content-card rounded-xl p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] text-[#1A1A2E]/50 font-medium">{label}</span>
        <Icon className="w-4 h-4 text-[#1A1A2E]/20" />
      </div>
      <p className="text-2xl font-bold text-[#1A1A2E]">{value}</p>
      <div className="flex items-center gap-1 mt-1.5">
        {up ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
        <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
          {change > 0 ? "+" : ""}{change}%
        </span>
        <span className="text-xs text-[#1A1A2E]/25 ml-1">vs 前期</span>
      </div>
    </div>
  );
}

function KpiRow({ data, label }: { data: KpiBlock; label: string }) {
  const cards = [
    { label: "CV数", value: data.cv.toLocaleString(), change: data.cvChange, up: data.cvChange >= 0, gradient: "from-[#FF6B9D] to-[#C084FC]", icon: Target },
    { label: "広告費", value: `¥${Math.round(data.spend).toLocaleString()}`, change: data.spendChange, up: data.spendChange <= 0, gradient: "from-[#D4A574] to-[#E8C98A]", icon: DollarSign },
    { label: "CPA", value: `¥${data.cpa.toLocaleString()}`, change: data.cpaChange, up: data.cpaChange <= 0, gradient: "from-[#22D3EE] to-[#6366F1]", icon: BarChart3 },
    { label: "CTR", value: `${data.ctr}%`, change: data.ctrChange, up: data.ctrChange >= 0, gradient: "from-[#34D399] to-[#22D3EE]", icon: MousePointerClick },
  ];
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1A1A2E]/40 uppercase tracking-wider mb-3">{label}</p>
      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { currentProject } = useProject();
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [topCreatives, setTopCreatives] = useState<TopCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard?projectId=${currentProject.id}&month=${selectedMonth}`).then((r) => r.json()),
      fetch(`/api/dashboard/top-creatives?projectId=${currentProject.id}&month=${selectedMonth}`).then((r) => r.json()),
    ])
      .then(([dashData, crData]) => {
        setDashboard(dashData.error ? null : dashData);
        setTopCreatives(Array.isArray(crData) ? crData : []);
      })
      .catch(() => { setDashboard(null); setTopCreatives([]); })
      .finally(() => setLoading(false));
  }, [currentProject.id, selectedMonth]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with month selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">ダッシュボード</h1>
          <p className="text-sm text-[#1A1A2E]/40 mt-0.5">{currentProject.name} — パフォーマンス</p>
        </div>
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none pl-4 pr-9 py-2 rounded-xl border border-black/[0.08] bg-white text-sm font-medium text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 cursor-pointer"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A1A2E]/40 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#9333EA] animate-spin" />
        </div>
      ) : dashboard ? (
        <>
          {/* Monthly KPI */}
          <KpiRow data={dashboard.monthly} label="月次パフォーマンス" />

          {/* Weekly KPI */}
          <KpiRow data={dashboard.weekly} label="直近7日間" />

          {/* Charts */}
          <div className="grid grid-cols-2 gap-4">
            {/* Daily CV chart */}
            <div className="content-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">日別CV推移</h3>
              {dashboard.daily.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-[#1A1A2E]/30">データがありません</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dashboard.daily}>
                    <defs>
                      <linearGradient id="cvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9333EA" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#9333EA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#999" }} width={40} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }}
                      formatter={(value: number) => [value, "CV"]}
                    />
                    <Area type="monotone" dataKey="cv" stroke="#9333EA" strokeWidth={2} fill="url(#cvGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Daily spend chart */}
            <div className="content-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">日別広告費推移</h3>
              {dashboard.daily.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-[#1A1A2E]/30">データがありません</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dashboard.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#999" }} width={50} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }}
                      formatter={(value: number) => [`¥${value.toLocaleString()}`, "広告費"]}
                    />
                    <Bar dataKey="spend" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top creatives */}
          <div className="content-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1A1A2E]">好調クリエイティブ TOP10</h2>
              <button className="text-[12px] text-[#9333EA] font-medium flex items-center gap-0.5 hover:opacity-70 transition-opacity">
                すべて見る<ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            {topCreatives.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#1A1A2E]/30">データがありません</div>
            ) : (
              <div className="divide-y divide-black/[0.04]">
                {topCreatives.map((c, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-black/[0.01] transition-colors">
                    <span className="w-6 text-center text-sm font-bold gradient-warm-text">{i + 1}</span>
                    <button
                      onClick={() => c.previewUrl && setPreviewUrl(c.previewUrl)}
                      className={`w-16 h-9 rounded shrink-0 overflow-hidden ${c.previewUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                    >
                      {c.thumbnailUrl ? (
                        <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-[#1A1A2E]/[0.04]" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A2E] truncate">{c.creativeName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-[#1A1A2E]">{c.cv} CV</p>
                      <p className="text-[11px] text-[#1A1A2E]/30">CPA {c.cpa}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-sm text-[#1A1A2E]/30">データを取得できませんでした</div>
      )}

      {previewUrl && (
        <VideoPreviewModal previewUrl={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}
