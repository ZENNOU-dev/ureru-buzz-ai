"use client";

import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, ArrowUpRight } from "lucide-react";

const KPI_CARDS = [
  { label: "CV数", value: "1,284", change: "+12.5%", up: true, gradient: "from-[#FF6B9D] to-[#C084FC]", icon: Target },
  { label: "広告費", value: "¥2,450,000", change: "-3.2%", up: false, gradient: "from-[#D4A574] to-[#E8C98A]", icon: DollarSign },
  { label: "CPA", value: "¥1,908", change: "-8.1%", up: true, gradient: "from-[#22D3EE] to-[#6366F1]", icon: BarChart3 },
  { label: "ROAS", value: "320%", change: "+15.3%", up: true, gradient: "from-[#34D399] to-[#22D3EE]", icon: TrendingUp },
];

const TOP_CREATIVES = [
  { title: "【衝撃】AIで月収100万円", cv: 342, cpa: "¥1,200", status: "配信中" },
  { title: "知らないと損する副業術", cv: 289, cpa: "¥1,450", status: "配信中" },
  { title: "たった3日で結果が出た", cv: 215, cpa: "¥1,680", status: "配信中" },
];

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">ダッシュボード</h1>
        <p className="text-sm text-[#1A1A2E]/40 mt-0.5">リアルタイムパフォーマンス</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="content-card rounded-xl p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${kpi.gradient}`} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-[#1A1A2E]/50 font-medium">{kpi.label}</span>
              <kpi.icon className="w-4 h-4 text-[#1A1A2E]/20" />
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E]">{kpi.value}</p>
            <div className="flex items-center gap-1 mt-1.5">
              {kpi.up ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
              <span className={`text-xs font-medium ${kpi.up ? "text-emerald-600" : "text-red-500"}`}>{kpi.change}</span>
              <span className="text-xs text-[#1A1A2E]/25 ml-1">vs 前週</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {["日別CV推移グラフ", "媒体別パフォーマンス"].map((t) => (
          <div key={t} className="content-card rounded-xl p-5 h-64 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-10 h-10 text-[#1A1A2E]/10 mx-auto mb-2" />
              <p className="text-sm text-[#1A1A2E]/30">{t}</p>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#1A1A2E]/[0.04] text-[#1A1A2E]/30 font-medium mt-2 inline-block">Coming Soon</span>
            </div>
          </div>
        ))}
      </div>
      <div className="content-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1A1A2E]">好調クリエイティブ</h2>
          <button className="text-[12px] text-[#9333EA] font-medium flex items-center gap-0.5 hover:opacity-70 transition-opacity">すべて見る<ArrowUpRight className="w-3 h-3" /></button>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {TOP_CREATIVES.map((c, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-black/[0.01] transition-colors">
              <span className="w-6 text-center text-sm font-bold gradient-warm-text">{i + 1}</span>
              <div className="w-16 h-9 rounded bg-[#1A1A2E]/[0.04] shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-[#1A1A2E] truncate">{c.title}</p></div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-[#1A1A2E]">{c.cv} CV</p>
                <p className="text-[11px] text-[#1A1A2E]/30">CPA {c.cpa}</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">{c.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
