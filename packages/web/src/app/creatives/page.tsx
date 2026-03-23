"use client";

import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

const RANKING = [
  { rank: 1, title: "【衝撃】AIで月収100万円超え", cv: 342, ctr: "4.2%" },
  { rank: 2, title: "知らないと損する副業術", cv: 289, ctr: "3.8%" },
  { rank: 3, title: "たった3日で結果が出た方法", cv: 215, ctr: "3.5%" },
  { rank: 4, title: "プロが教える広告の作り方", cv: 198, ctr: "3.2%" },
  { rank: 5, title: "9割が知らないSNS活用法", cv: 176, ctr: "3.0%" },
];

const TABLE_DATA = [
  { status: "配信中", title: "【衝撃】AIで月収100万円超え", media: "TikTok", cv: 342, imp: "81,428", ctr: "4.2%", cpa: "¥1,200", date: "2026/03/15" },
  { status: "配信中", title: "知らないと損する副業術", media: "Instagram", cv: 289, imp: "76,052", ctr: "3.8%", cpa: "¥1,450", date: "2026/03/14" },
  { status: "審査中", title: "たった3日で結果が出た方法", media: "TikTok", cv: 215, imp: "61,428", ctr: "3.5%", cpa: "¥1,680", date: "2026/03/13" },
  { status: "停止", title: "プロが教える広告の作り方", media: "YouTube", cv: 198, imp: "61,875", ctr: "3.2%", cpa: "¥1,820", date: "2026/03/12" },
  { status: "配信中", title: "9割が知らないSNS活用法", media: "TikTok", cv: 176, imp: "58,666", ctr: "3.0%", cpa: "¥1,950", date: "2026/03/11" },
];

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { "配信中": "bg-emerald-50 text-emerald-600", "審査中": "bg-amber-50 text-amber-600", "停止": "bg-gray-100 text-gray-500" };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c[status] || c["停止"]}`}>{status}</span>;
}

export default function CreativesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">クリエイティブ</h1>
        <p className="text-sm text-[#1A1A2E]/40 mt-0.5">クリエイティブ一覧・ランキング</p>
      </div>
      <div className="content-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#1A1A2E]">CVランキング</h2>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 rounded-lg border border-black/[0.06] flex items-center justify-center hover:bg-black/[0.02]"><ChevronLeft className="w-4 h-4 text-[#1A1A2E]/40" /></button>
            <button className="w-7 h-7 rounded-lg border border-black/[0.06] flex items-center justify-center hover:bg-black/[0.02]"><ChevronRight className="w-4 h-4 text-[#1A1A2E]/40" /></button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {RANKING.map((item) => (
            <div key={item.rank} className="rounded-xl border border-black/[0.06] overflow-hidden hover:shadow-md transition-all cursor-pointer">
              <div className="aspect-[9/16] bg-[#1A1A2E]/[0.03] relative">
                <span className="absolute top-2 left-2 w-6 h-6 rounded-full gradient-warm text-white text-[11px] font-bold flex items-center justify-center">{item.rank}</span>
              </div>
              <div className="p-2.5">
                <p className="text-[12px] font-medium text-[#1A1A2E] truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold text-[#9333EA]">{item.cv} CV</span>
                  <span className="text-[11px] text-[#1A1A2E]/30">CTR {item.ctr}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A2E]/30" />
          <input type="text" placeholder="クリエイティブを検索..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/30 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-colors" />
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm text-[#1A1A2E]/60 hover:bg-black/[0.02] transition-colors"><Filter className="w-4 h-4" />フィルター</button>
      </div>
      <div className="content-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.04]">
              {["ステータス","サムネイル","タイトル","媒体","CV","IMP","CTR","CPA","作成日"].map((h,i) => (
                <th key={h} className={`${i>=4?"text-right":"text-left"} px-4 py-3 text-[12px] font-semibold text-[#1A1A2E]/35`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.03]">
            {TABLE_DATA.map((row, i) => (
              <tr key={i} className="hover:bg-black/[0.01] transition-colors cursor-pointer">
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3"><div className="w-10 h-6 rounded bg-[#1A1A2E]/[0.04]" /></td>
                <td className="px-4 py-3 text-[13px] font-medium text-[#1A1A2E] max-w-[200px] truncate">{row.title}</td>
                <td className="px-4 py-3 text-[13px] text-[#1A1A2E]/60">{row.media}</td>
                <td className="px-4 py-3 text-right text-[13px] font-bold text-[#1A1A2E]">{row.cv}</td>
                <td className="px-4 py-3 text-right text-[13px] text-[#1A1A2E]/50">{row.imp}</td>
                <td className="px-4 py-3 text-right text-[13px] text-[#1A1A2E]/50">{row.ctr}</td>
                <td className="px-4 py-3 text-right text-[13px] text-[#1A1A2E]/50">{row.cpa}</td>
                <td className="px-4 py-3 text-right text-[13px] text-[#1A1A2E]/30">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
