"use client";

import { use, useRef, useCallback, type SetStateAction } from "react";
import { usePageUndoDraft } from "@/hooks/use-page-undo-draft";
import { ArrowLeft, Plus, Play, LayoutList, LayoutGrid, Film, Calendar, User, Megaphone, Lightbulb, Search, X, Target, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
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
  intent: string; // 狙い・意図
  target: string; // ターゲット
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  "完成": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "修正中": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  "確認待ち": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
};

// ─── Sample Data ──────────────────────────────────────
const DELIVERABLES: DeliverableItem[] = [
  { id: 1, videoName: "渋谷_AI副業A.mp4", completedDate: "2025/12/28", person: "渋谷", appeal: "AI活用型訴求", plan: "AI副業", adName: "AI副業A", status: "完成", duration: "0:32", intent: "AIで副業を始める手軽さを訴求。未経験者の不安を解消しつつ、収入変化のインパクトで興味を引く", target: "20〜30代会社員で副業に興味がある層" },
  { id: 2, videoName: "渋谷_AI副業B.mp4", completedDate: "2025/12/28", person: "渋谷", appeal: "AI活用型訴求", plan: "AI副業", adName: "AI副業B", status: "完成", duration: "0:28", intent: "AI副業Aのフック違いバージョン。収入面のインパクトを前面に出す構成", target: "20〜30代会社員で副業に興味がある層" },
  { id: 3, videoName: "渋谷_AI副業C.mp4", completedDate: "2025/12/28", person: "渋谷", appeal: "AI活用型訴求", plan: "AI副業", adName: "AI副業C", status: "完成", duration: "0:35", intent: "共感寄りのフックで職場不満層にリーチ。転身ストーリーで感情を動かす", target: "職場環境に不満を持つ20〜30代" },
  { id: 4, videoName: "渋谷_特典推しA.mp4", completedDate: "2025/12/29", person: "渋谷", appeal: "AI活用型訴求", plan: "三日坊主", adName: "特典推しA", status: "完成", duration: "0:30", intent: "三日坊主でも続けられる仕組みを訴求。特典内容を前面に出してCV率向上を狙う", target: "過去に挫折経験がある層" },
  { id: 5, videoName: "渋谷_特典推しB.mp4", completedDate: "2025/12/29", person: "渋谷", appeal: "AI活用型訴求", plan: "三日坊主", adName: "特典推しB", status: "完成", duration: "0:27", intent: "特典推しAのテロップ違い。よりシンプルな構成でテスト", target: "過去に挫折経験がある層" },
  { id: 6, videoName: "松永_AI副業BU1A.mp4", completedDate: "2026/02/20", person: "松永", appeal: "AI活用型訴求", plan: "AI副業BU1", adName: "AI副業BU1-A", status: "完成", duration: "0:31", intent: "BU1向けリメイク。トレンド要素を追加し新規層へリーチ拡大", target: "SNSアクティブな20代" },
  { id: 7, videoName: "横野_女性2.0_A.mp4", completedDate: "2026/03/01", person: "横野", appeal: "AIフリーランス訴求", plan: "女性2.0", adName: "女性2.0-A", status: "完成", duration: "0:33", intent: "女性フリーランスの成功体験で共感を獲得。ライフスタイルの変化を視覚的に表現", target: "キャリアチェンジを考えている20〜30代女性" },
  { id: 8, videoName: "横野_フリーランス2.0体験談.mp4", completedDate: "", person: "横野", appeal: "AIフリーランス訴求", plan: "フリーランス2.0体験談", adName: "体験談A", status: "修正中", duration: "0:29", intent: "リアルな体験談で信頼性を担保。数字での証明を入れてCVを促進", target: "フリーランスに興味がある全年代" },
  { id: 9, videoName: "横野_フリーランス2.0体験談_B.mp4", completedDate: "", person: "横野", appeal: "AIフリーランス訴求", plan: "フリーランス2.0体験談", adName: "体験談B", status: "確認待ち", duration: "0:34", intent: "体験談Aのフック違い。職場環境の不満から入るパターン", target: "フリーランスに興味がある全年代" },
];

// ─── Main Page ────────────────────────────────────────
type DeliverablesDraft = {
  viewMode: "card" | "list";
  search: string;
  statusFilter: "" | "完成" | "修正中" | "確認待ち";
  selectedId: number | null;
};

export default function DeliverablesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [draft, setField] = usePageUndoDraft<DeliverablesDraft>(
    () => ({ viewMode: "card", search: "", statusFilter: "", selectedId: null }),
    { mergeWindowMs: 400 },
  );
  const { viewMode, search, statusFilter, selectedId } = draft;
  const setViewMode = (u: SetStateAction<DeliverablesDraft["viewMode"]>) => setField("viewMode", u);
  const setSearch = (u: SetStateAction<string>) => setField("search", u);
  const setStatusFilter = (u: SetStateAction<DeliverablesDraft["statusFilter"]>) => setField("statusFilter", u);
  const setSelectedId = (u: SetStateAction<number | null>) => setField("selectedId", u);

  // Sort by date descending (newest first)
  const sorted = [...DELIVERABLES].sort((a, b) => {
    if (!a.completedDate && !b.completedDate) return 0;
    if (!a.completedDate) return -1; // incomplete items first
    if (!b.completedDate) return -1;
    return b.completedDate.localeCompare(a.completedDate);
  });

  const filtered = sorted.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.adName.toLowerCase().includes(q) || d.videoName.toLowerCase().includes(q) || d.appeal.toLowerCase().includes(q) || d.plan.toLowerCase().includes(q);
  });

  const selectedItem = DELIVERABLES.find((d) => d.id === selectedId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollBy = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 600, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-[#1A1A2E] flex-1">動画一覧</h1>
          <span className="text-[11px] text-[#1A1A2E]/30">{DELIVERABLES.length}件</span>
          <div className="flex items-center bg-[#FAF8F5] rounded-lg p-0.5 border border-black/[0.04]">
            <button onClick={() => setViewMode("card")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "card" ? "bg-white shadow-sm text-[#9333EA]" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-sm text-[#9333EA]" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[#FAF8F5] rounded-xl border border-black/[0.06] px-3 py-2">
            <Search className="w-4 h-4 text-[#1A1A2E]/25" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="動画名・訴求名・企画名で検索..."
              className="flex-1 text-[12px] text-[#1A1A2E]/70 bg-transparent outline-none placeholder:text-[#1A1A2E]/20" />
          </div>
          <div className="flex gap-1 shrink-0">
            {(["", "完成", "修正中", "確認待ち"] as const).map((s) => {
              const label = s || "すべて";
              const count = s ? DELIVERABLES.filter((d) => d.status === s).length : DELIVERABLES.length;
              return (
                <button key={label} onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-full font-medium transition-all ${
                    statusFilter === s ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"
                  }`}>
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Card View - horizontal slider, 4 compact cards visible */}
        {viewMode === "card" && (
          <div className="relative">
            {/* Scroll buttons - outside cards */}
            <button onClick={() => scrollBy(-1)}
              className="absolute -left-1 top-[40%] -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-lg border border-black/[0.06] flex items-center justify-center text-[#1A1A2E]/40 hover:text-[#9333EA] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => scrollBy(1)}
              className="absolute -right-1 top-[40%] -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-lg border border-black/[0.06] flex items-center justify-center text-[#1A1A2E]/40 hover:text-[#9333EA] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>

            <div ref={scrollRef} className="overflow-x-auto px-10 pb-3 flex gap-3 snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {filtered.map((item) => {
                const ss = STATUS_STYLES[item.status];
                return (
                  <div key={item.id} onClick={() => setSelectedId(item.id)}
                    className={`bg-white rounded-lg border border-black/[0.06] overflow-hidden hover:shadow-md hover:border-[#9333EA]/20 transition-all cursor-pointer group snap-start shrink-0 ${
                      item.status === "修正中" ? "border-l-3 border-l-amber-400" : item.status === "確認待ち" ? "border-l-3 border-l-blue-400" : ""
                    }`}
                    style={{ width: "calc(25% - 9px)", minWidth: "160px" }}>
                    {/* Compact vertical thumbnail */}
                    <div className="aspect-[9/14] bg-gradient-to-b from-[#1a1a2e]/60 to-[#1a1a2e]/90 relative flex items-center justify-center">
                      <Film className="w-6 h-6 text-white/15" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-4 h-4 text-white ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[8px] font-medium px-1 py-0.5 rounded">
                        {item.duration}
                      </div>
                      <div className="absolute top-1.5 right-1.5">
                        <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>{item.status}</span>
                      </div>
                    </div>
                    {/* Compact info */}
                    <div className="p-2">
                      <h3 className="text-[11px] font-bold text-[#1A1A2E]/80 truncate group-hover:text-[#9333EA] transition-colors">
                        {item.adName}
                      </h3>
                      <p className="text-[8px] text-[#1A1A2E]/35 leading-snug line-clamp-1 mt-0.5">{item.intent}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[8px] text-[#1A1A2E]/25">
                        <span className="truncate">{item.appeal}</span>
                        <span className="text-[#1A1A2E]/10">|</span>
                        <span className="truncate">{item.plan}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-black/[0.02] text-[8px] text-[#1A1A2E]/20">
                        <span>{item.person}</span>
                        {item.completedDate && <span>{item.completedDate}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Add card */}
              <div className="bg-white/50 rounded-lg border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.02] transition-all flex flex-col items-center justify-center gap-1.5 text-[#1A1A2E]/20 hover:text-[#9333EA]/50 cursor-pointer snap-start shrink-0"
                style={{ width: "calc(25% - 9px)", minWidth: "160px" }}>
                <Plus className="w-5 h-5" />
                <span className="text-[9px] font-medium">追加</span>
              </div>
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
              <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr_80px_100px_80px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/50 uppercase tracking-wider">
                <div className="px-2 py-3"></div>
                <div className="px-2 py-3">広告名</div>
                <div className="px-2 py-3">訴求名</div>
                <div className="px-2 py-3">企画名</div>
                <div className="px-2 py-3">担当者</div>
                <div className="px-2 py-3">尺</div>
                <div className="px-2 py-3">完成日</div>
                <div className="px-2 py-3">状態</div>
              </div>
              {filtered.map((item) => {
                const ss = STATUS_STYLES[item.status];
                return (
                  <div key={item.id} onClick={() => setSelectedId(item.id)}
                    className={`grid grid-cols-[56px_1fr_1fr_1fr_1fr_80px_100px_80px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors cursor-pointer ${
                      item.status === "修正中" ? "bg-amber-50/20" : item.status === "確認待ち" ? "bg-blue-50/20" : ""
                    }`}>
                    <div className="px-1.5 py-2 flex items-center justify-center">
                      <div className="w-[36px] aspect-[9/16] rounded-[3px] bg-gradient-to-b from-[#1a1a2e]/40 to-[#1a1a2e]/70 flex items-center justify-center relative">
                        <Play className="w-3 h-3 text-white/40 ml-0.5" />
                        <span className="absolute bottom-0.5 right-0.5 text-[6px] text-white/50">{item.duration}</span>
                      </div>
                    </div>
                    <div className="px-2 py-3 flex flex-col justify-center">
                      <p className="text-[12px] text-[#1A1A2E]/80 font-semibold truncate">{item.adName}</p>
                      <p className="text-[9px] text-[#1A1A2E]/30 truncate">{item.videoName}</p>
                    </div>
                    <div className="px-2 py-3 flex items-center text-[11px] text-[#1A1A2E]/50 truncate">{item.appeal}</div>
                    <div className="px-2 py-3 flex items-center text-[11px] text-[#1A1A2E]/60 truncate">{item.plan}</div>
                    <div className="px-2 py-3 flex items-center text-[12px] text-[#1A1A2E]/70 font-medium">{item.person}</div>
                    <div className="px-2 py-3 flex items-center text-[11px] text-[#1A1A2E]/50">{item.duration}</div>
                    <div className="px-2 py-3 flex items-center text-[11px] text-[#1A1A2E]/50">{item.completedDate || "—"}</div>
                    <div className="px-2 py-3 flex items-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ss.bg} ${ss.text}`}>{item.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#1A1A2E]/20">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-[13px] font-medium">動画が見つかりません</p>
          </div>
        )}
      </div>

      {/* Detail modal when clicking a video */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setSelectedId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Video preview */}
            <div className="aspect-video bg-gradient-to-br from-[#1a1a2e]/70 to-[#1a1a2e]/90 relative flex items-center justify-center">
              <Film className="w-16 h-16 text-white/15" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                  <Play className="w-7 h-7 text-white ml-1" />
                </div>
              </div>
              <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-medium px-2 py-1 rounded">{selectedItem.duration}</div>
              <div className="absolute top-3 right-3">
                {(() => { const ss = STATUS_STYLES[selectedItem.status]; return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>{selectedItem.status}</span>; })()}
              </div>
              <button onClick={() => setSelectedId(null)} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-3 text-[10px] text-white/50">{selectedItem.videoName}</div>
            </div>
            {/* Detail info */}
            <div className="p-6">
              <h2 className="text-[18px] font-bold text-[#1A1A2E] mb-3">{selectedItem.adName}</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-[#FAF8F5] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 font-bold mb-1">
                    <Megaphone className="w-3 h-3" /> 訴求名
                  </div>
                  <p className="text-[13px] text-[#1A1A2E]/70 font-medium">{selectedItem.appeal}</p>
                </div>
                <div className="bg-[#FAF8F5] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 font-bold mb-1">
                    <Lightbulb className="w-3 h-3" /> 企画名
                  </div>
                  <p className="text-[13px] text-[#1A1A2E]/70 font-medium">{selectedItem.plan}</p>
                </div>
              </div>

              <div className="bg-[#FAF8F5] rounded-xl p-3 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 font-bold mb-1">
                  <MessageSquare className="w-3 h-3" /> 狙い・意図
                </div>
                <p className="text-[12px] text-[#1A1A2E]/60 leading-relaxed">{selectedItem.intent}</p>
              </div>

              <div className="bg-[#FAF8F5] rounded-xl p-3 mb-4">
                <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 font-bold mb-1">
                  <Target className="w-3 h-3" /> ターゲット
                </div>
                <p className="text-[12px] text-[#1A1A2E]/60 leading-relaxed">{selectedItem.target}</p>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-[#1A1A2E]/40 pt-3 border-t border-black/[0.04]">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedItem.person}</span>
                {selectedItem.completedDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {selectedItem.completedDate}</span>}
                <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" /> {selectedItem.duration}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
