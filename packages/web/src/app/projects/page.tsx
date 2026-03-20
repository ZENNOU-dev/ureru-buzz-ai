"use client";

import { Plus, Clapperboard, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

const MOCK_PROJECTS = [
  {
    id: "proj-001",
    name: "サプリメントA 動画広告",
    client: "株式会社サンプルA",
    status: "制作中",
    updatedAt: "2026-03-18",
    scriptCount: 3,
  },
  {
    id: "proj-002",
    name: "美容液B プロモーション",
    client: "株式会社サンプルB",
    status: "レビュー中",
    updatedAt: "2026-03-15",
    scriptCount: 5,
  },
  {
    id: "proj-003",
    name: "フィットネスC キャンペーン",
    client: "株式会社サンプルC",
    status: "完了",
    updatedAt: "2026-03-10",
    scriptCount: 1,
  },
];

const STATUS_COLORS: Record<string, string> = {
  "制作中": "bg-blue-100 text-blue-700",
  "レビュー中": "bg-amber-100 text-amber-700",
  "完了": "bg-green-100 text-green-700",
};

export default function ProjectsPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">案件一覧</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {MOCK_PROJECTS.length} 件の案件
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors">
          <Plus className="w-4 h-4" />
          新規案件
        </button>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_PROJECTS.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="group bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Clapperboard className="w-5 h-5 text-zinc-500" />
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] ?? "bg-zinc-100 text-zinc-600"}`}
              >
                {project.status}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-zinc-900 mb-1">
              {project.name}
            </h3>
            <p className="text-xs text-zinc-500 mb-3">{project.client}</p>

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {project.updatedAt}
              </span>
              <span className="flex items-center gap-1 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                開く
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        ))}

        {/* Add project card */}
        <button className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 p-5 min-h-[160px] text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors">
          <Plus className="w-6 h-6" />
          <span className="text-sm font-medium">新規案件を追加</span>
        </button>
      </div>
    </div>
  );
}
