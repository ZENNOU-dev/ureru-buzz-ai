"use client";

import { FileText, Plus } from "lucide-react";

const MOCK_SCRIPTS = [
  { id: 1, title: "台本 A-001: フック重視パターン", status: "完了", updatedAt: "2026-03-18" },
  { id: 2, title: "台本 A-002: 体験談パターン", status: "作成中", updatedAt: "2026-03-17" },
  { id: 3, title: "台本 A-003: 比較訴求パターン", status: "下書き", updatedAt: "2026-03-15" },
];

export default function ScriptsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900">台本一覧</h2>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          新規台本
        </button>
      </div>

      <div className="space-y-2">
        {MOCK_SCRIPTS.map((script) => (
          <div
            key={script.id}
            className="flex items-center gap-3 bg-white rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {script.title}
              </p>
              <p className="text-xs text-zinc-400">{script.updatedAt}</p>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                script.status === "完了"
                  ? "bg-green-100 text-green-700"
                  : script.status === "作成中"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {script.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
