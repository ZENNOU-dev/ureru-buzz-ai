"use client";

import { Plus, Clapperboard, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

const MOCK_PROJECTS = [
  { id: "proj-001", name: "サプリメントA 動画広告", client: "株式会社サンプルA", status: "制作中", updatedAt: "2026-03-18" },
  { id: "proj-002", name: "美容液B プロモーション", client: "株式会社サンプルB", status: "レビュー中", updatedAt: "2026-03-15" },
  { id: "proj-003", name: "フィットネスC キャンペーン", client: "株式会社サンプルC", status: "完了", updatedAt: "2026-03-10" },
];

const STATUS_COLORS: Record<string, string> = {
  "制作中": "bg-purple-50 text-[#9333EA]",
  "レビュー中": "bg-amber-50 text-amber-600",
  "完了": "bg-emerald-50 text-emerald-600",
};

export default function ProjectsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">制作</h1>
          <p className="text-sm text-[#1A1A2E]/40 mt-0.5">{MOCK_PROJECTS.length} 件の案件</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] gradient-warm">
          <Plus className="w-4 h-4" />新規案件
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_PROJECTS.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}/scripts/script-001`} className="group content-card content-card-hover rounded-xl p-5 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Clapperboard className="w-5 h-5 text-[#9333EA]" /></div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-500"}`}>{p.status}</span>
            </div>
            <h3 className="text-sm font-bold text-[#1A1A2E] mb-1">{p.name}</h3>
            <p className="text-xs text-[#1A1A2E]/40 mb-3">{p.client}</p>
            <div className="flex items-center justify-between text-xs text-[#1A1A2E]/25">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.updatedAt}</span>
              <span className="flex items-center gap-1 text-[#9333EA] font-medium opacity-0 group-hover:opacity-100 transition-opacity">開く<ArrowRight className="w-3 h-3" /></span>
            </div>
          </Link>
        ))}
        <button className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/[0.08] p-5 min-h-[160px] text-[#1A1A2E]/25 hover:border-[#9333EA]/30 hover:text-[#9333EA]/70 transition-colors">
          <Plus className="w-6 h-6" /><span className="text-sm font-medium">新規案件を追加</span>
        </button>
      </div>
    </div>
  );
}
