"use client";

import { useState } from "react";
import { ArrowLeft, Type, User, Mic, Music } from "lucide-react";
import Link from "next/link";

const STATUS_OPTIONS = [
  { value: "下書き", bg: "bg-zinc-100", text: "text-zinc-600" },
  { value: "作成中", bg: "bg-amber-100", text: "text-amber-700" },
  { value: "承認待ち", bg: "bg-blue-100", text: "text-blue-700" },
  { value: "承認済", bg: "bg-emerald-100", text: "text-emerald-700" },
];

export function ScriptHeader({
  projectId,
  title,
  status,
  totalChars,
  onTitleChange,
  onStatusChange,
}: {
  projectId: string;
  title: string;
  status: string;
  totalChars: number;
  onTitleChange: (v: string) => void;
  onStatusChange: (v: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const statusOption =
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div className="bg-white border-b border-zinc-200">
      {/* Title Row */}
      <div className="px-6 py-3 flex items-center gap-3">
        <Link
          href={`/projects/${projectId}/scripts`}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              onTitleChange(titleDraft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditingTitle(false);
                onTitleChange(titleDraft);
              }
              if (e.key === "Escape") {
                setTitleDraft(title);
                setEditingTitle(false);
              }
            }}
            className="text-lg font-bold text-zinc-900 bg-transparent border-b-2 border-blue-400 outline-none flex-1"
          />
        ) : (
          <h1
            onClick={() => {
              setTitleDraft(title);
              setEditingTitle(true);
            }}
            className="text-lg font-bold text-zinc-900 cursor-text hover:bg-zinc-50 rounded px-1 -mx-1 transition-colors flex-1"
          >
            {title}
          </h1>
        )}

        {/* Status badge dropdown */}
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={`text-[11px] font-semibold px-3 py-1 rounded-full border-0 outline-none cursor-pointer appearance-none ${statusOption.bg} ${statusOption.text}`}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
      </div>

      {/* Global Info Bar */}
      <div className="px-6 pb-3 flex items-center gap-6 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" />
          <span>
            全体文字数:{" "}
            <span className="font-semibold text-zinc-700">{totalChars}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          <span>話者: 女性ナレーター</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5" />
          <span>音声: 未設定</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" />
          <span>BGM: 未設定</span>
        </div>
      </div>
    </div>
  );
}
