"use client";

import { use, useState } from "react";
import { ArrowLeft, Plus, Play, Download, LayoutList, LayoutGrid, Film, Calendar, User, Megaphone, Lightbulb, Tag } from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type DeliverableItem = {
  id: number;
  videoName: string;
  completedDate: string;
  person: string;
  appeal: string;
  plan: string;
  adName: string;
  status: "完成" | "修正中" | "確認待ち";
  duration: string;
  thumbnailUrl: string;
};

// ─── Constants ────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  "完成": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "修正中": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  "確認待ち": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
};

// ─── Sample Data ──────────────────────────────────────
const DELIVERABLES: DeliverableItem[] = [
  { id: 1, videoName: "渋谷_AI副業A.mp4", completedDate: "2025/12/28", person: "渋谷", appeal: "AI活用型訴求", plan: "AI副業", adName: "AI副業A", status: "完成", duration: "0:32", thumbnailUrl: "" },
  { id: 2, videoName: "渋谷_AI副業B.mp4", completedDate: "2025/12/28", person: "渋谷", appeal: "AI活用型訴求", plan: "AI副業", adName: "AI副業B", status: "完成", duration: "0:28", thumbnailUrl: "" },
  { id: 3, videoName: "渋谷_AI副業C.mp4", completedDate: "2025/12/28", person: "渋谷", appeal: "AI活用型訴求", plan: "AI副業", adName: "AI副業C", status: "完成", duration: "0:35", thumbnailUrl: "" },
  { id: 4, videoName: "渋谷_特典推しA.mp4", completedDate: "2025/12/29", person: "渋谷", appeal: "AI活用型訴求", plan: "三日坊主", adName: "特典推しA", status: "完成", duration: "0:30", thumbnailUrl: "" },
  { id: 5, videoName: "渋谷_特典推しB.mp4", completedDate: "2025/12/29", person: "渋谷", appeal: "AI活用型訴求", plan: "三日坊主", adName: "特典推しB", status: "完成", duration: "0:27", thumbnailUrl: "" },
  { id: 6, videoName: "松永_AI副業BU1A.mp4", completedDate: "2026/02/20", person: "松永", appeal: "AI活用型訴求", plan: "AI副業BU1", adName: "AI副業BU1-A", status: "完成", duration: "0:31", thumbnailUrl: "" },
  { id: 7, videoName: "横野_女性2.0_A.mp4", completedDate: "2026/03/01", person: "横野", appeal: "AIフリーランス訴求", plan: "女性2.0", adName: "女性2.0-A", status: "完成", duration: "0:33", thumbnailUrl: "" },
  { id: 8, videoName: "横野_フリーランス2.0体験談.mp4", completedDate: "", person: "横野", appeal: "AIフリーランス訴求", plan: "フリーランス2.0体験談", adName: "体験談A", status: "修正中", duration: "0:29", thumbnailUrl: "" },
  { id: 9, videoName: "横野_フリーランス2.0体験談_B.mp4", completedDate: "", person: "横野", appeal: "AIフリーランス訴求", plan: "フリーランス2.0体験談", adName: "体験談B", status: "確認待ち", duration: "0:34", thumbnailUrl: "" },
];

// ─── Main Page ────────────────────────────────────────
export default function DeliverablesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [viewMode, setViewMode] = useState<"table" | "card">("card");

  const stats = {
    total: DELIVERABLES.length,
    completed: DELIVERABLES.filter((d) => d.status === "完成").length,
    inProgress: DELIVERABLES.filter((d) => d.status === "修正中").length,
    pending: DELIVERABLES.filter((d) => d.status === "確認待ち").length,
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 py-4 flex items-center gap-3">
          <Link href={`/projects/${projectId}/editing`}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#1A1A2E]/30 font-medium mb-0.5">納品動画</p>
            <h1 className="text-lg font-bold text-[#1A1A2E]">完成動画一覧</h1>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#1A1A2E]/30">全{stats.total}件</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">完成 {stats.completed}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">修正中 {stats.inProgress}</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">確認待ち {stats.pending}</span>
          </div>
          {/* View toggle */}
          <div className="flex items-center bg-[#FAF8F5] rounded-lg p-0.5 border border-black/[0.04]">
            <button onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-white shadow-sm text-[#9333EA]" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("card")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "card" ? "bg-white shadow-sm text-[#9333EA]" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* ── Card View ── */}
        {viewMode === "card" && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {DELIVERABLES.map((item) => {
                const ss = STATUS_STYLES[item.status];
                return (
                  <div key={item.id} className={`bg-white rounded-xl border border-black/[0.06] overflow-hidden hover:shadow-lg hover:border-[#9333EA]/20 transition-all group ${
                    item.status === "修正中" ? "border-l-4 border-l-amber-400" : item.status === "確認待ち" ? "border-l-4 border-l-blue-400" : ""
                  }`}>
                    {/* Thumbnail */}
                    <div className="aspect-[9/16] bg-gradient-to-b from-[#1a1a2e]/60 to-[#1a1a2e]/90 relative flex items-center justify-center">
                      <Film className="w-8 h-8 text-white/20" />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                      {/* Duration */}
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                        {item.duration}
                      </div>
                      {/* Status */}
                      <div className="absolute top-2 right-2">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>{item.status}</span>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-[12px] font-bold text-[#1A1A2E]/80 mb-1 truncate group-hover:text-[#9333EA] transition-colors">
                        {item.adName}
                      </h3>
                      <div className="space-y-0.5 text-[10px] text-[#1A1A2E]/40">
                        <div className="flex items-center gap-1.5">
                          <Megaphone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.appeal}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.plan}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 pt-1 border-t border-black/[0.03]">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.person}</span>
                          {item.completedDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.completedDate}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Add button */}
              <div className="bg-white/50 rounded-xl border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.02] transition-all flex flex-col items-center justify-center gap-2 text-[#1A1A2E]/20 hover:text-[#9333EA]/50 cursor-pointer min-h-[200px]">
                <Plus className="w-6 h-6" />
                <span className="text-[11px] font-medium">動画を追加</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Table View ── */}
        {viewMode === "table" && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[40px_1fr_1fr_100px_1fr_1fr_1fr_100px_80px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/40 uppercase tracking-wider">
                <div className="px-2 py-3"></div>
                <div className="px-2 py-3">広告名</div>
                <div className="px-2 py-3">動画ファイル</div>
                <div className="px-2 py-3">完成日</div>
                <div className="px-2 py-3">担当者</div>
                <div className="px-2 py-3">訴求名</div>
                <div className="px-2 py-3">企画名</div>
                <div className="px-2 py-3">尺</div>
                <div className="px-2 py-3">ステータス</div>
              </div>
              {/* Rows */}
              {DELIVERABLES.map((item) => {
                const ss = STATUS_STYLES[item.status];
                return (
                  <div key={item.id} className={`grid grid-cols-[40px_1fr_1fr_100px_1fr_1fr_1fr_100px_80px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors ${
                    item.status === "修正中" ? "bg-amber-50/20" : item.status === "確認待ち" ? "bg-blue-50/20" : ""
                  }`}>
                    <div className="px-2 py-3.5 flex items-center justify-center">
                      <div className="w-7 h-7 rounded bg-[#1a1a2e]/10 flex items-center justify-center">
                        <Play className="w-3 h-3 text-[#1A1A2E]/30 ml-0.5" />
                      </div>
                    </div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/80 font-semibold truncate flex items-center">{item.adName}</div>
                    <div className="px-2 py-3.5 text-[11px] text-[#1A1A2E]/50 truncate flex items-center">{item.videoName}</div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/60 flex items-center">{item.completedDate || "—"}</div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/70 font-medium flex items-center">{item.person}</div>
                    <div className="px-2 py-3.5 text-[11px] text-[#1A1A2E]/50 truncate flex items-center">{item.appeal}</div>
                    <div className="px-2 py-3.5 text-[11px] text-[#1A1A2E]/60 truncate flex items-center">{item.plan}</div>
                    <div className="px-2 py-3.5 text-[11px] text-[#1A1A2E]/40 flex items-center">{item.duration}</div>
                    <div className="px-2 py-3.5 flex items-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ss.bg} ${ss.text}`}>{item.status}</span>
                    </div>
                  </div>
                );
              })}
              <button className="w-full py-3 text-[11px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] flex items-center justify-center gap-1 transition-all">
                <Plus className="w-3 h-3" /> 動画を追加
              </button>
            </div>
          </div>
        )}
      </div>

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
