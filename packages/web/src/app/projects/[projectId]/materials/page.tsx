"use client";

import { use, type SetStateAction } from "react";
import { usePageUndoDraft } from "@/hooks/use-page-undo-draft";
import { Search, Film, Image, Music, Calendar, Clock, Smartphone, LayoutList, LayoutGrid, Volume2, X, Play, Scissors } from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type MaterialKind = "動画" | "画像" | "BGM" | "SE";

type MaterialSource = "提供" | "自社撮影" | "フリー";

type UsedSection = { label: string; start: string; end: string };

type MaterialItem = {
  id: string;
  name: string;
  summary: string;
  kind: MaterialKind;
  source: MaterialSource;
  duration?: string;
  addedAt: string;
  usedSections?: UsedSection[]; // よく使われる利用箇所
};

const SOURCE_STYLES: Record<MaterialSource, { bg: string; text: string }> = {
  "提供": { bg: "bg-sky-50", text: "text-sky-600" },
  "自社撮影": { bg: "bg-rose-50", text: "text-rose-600" },
  "フリー": { bg: "bg-gray-100", text: "text-gray-500" },
};

// ─── Sample Data ──────────────────────────────────────
const MATERIALS: MaterialItem[] = [
  { id: "m-001", name: "AI副業_メイン訴求A.mp4", summary: "AIツールで副業を始めた体験者のインタビュー正面カット", kind: "動画", source: "自社撮影", duration: "0:32", addedAt: "2026-03-20", usedSections: [{ label: "フック", start: "00:00", end: "00:05" }, { label: "ベネフィット", start: "00:12", end: "00:20" }] },
  { id: "m-002", name: "フリーランス体験談_B.mp4", summary: "フリーランス転身後の生活変化を語るインタビュー", kind: "動画", source: "自社撮影", duration: "0:28", addedAt: "2026-03-19", usedSections: [{ label: "共感パート", start: "00:03", end: "00:10" }] },
  { id: "m-003", name: "女性2.0_インタビュー.mp4", summary: "女性フリーランスの成功体験インタビュー", kind: "動画", source: "自社撮影", duration: "0:45", addedAt: "2026-03-18", usedSections: [{ label: "フック", start: "00:00", end: "00:08" }, { label: "商品紹介", start: "00:15", end: "00:30" }, { label: "CTA", start: "00:38", end: "00:45" }] },
  { id: "m-004", name: "サムネイル_AI副業.png", summary: "AI副業訴求用のサムネイル画像", kind: "画像", source: "自社撮影", addedAt: "2026-03-20" },
  { id: "m-005", name: "テロップ背景_グラデ.png", summary: "テロップ用グラデーション背景素材", kind: "画像", source: "フリー", addedAt: "2026-03-19" },
  { id: "m-006", name: "BGM_アップテンポ01.mp3", summary: "明るくポジティブなアップテンポBGM", kind: "BGM", source: "フリー", duration: "1:20", addedAt: "2026-03-17", usedSections: [{ label: "フック〜商品紹介", start: "00:00", end: "00:45" }, { label: "サビ部分", start: "00:30", end: "00:50" }] },
  { id: "m-007", name: "SE_決定音.mp3", summary: "CTA部分で使用する決定音エフェクト", kind: "SE", source: "フリー", duration: "0:02", addedAt: "2026-03-17", usedSections: [{ label: "CTA", start: "00:00", end: "00:02" }] },
  { id: "m-008", name: "特典推し_撮影素材.mp4", summary: "特典内容を紹介する撮影済み動画素材", kind: "動画", source: "提供", duration: "0:38", addedAt: "2026-03-16", usedSections: [{ label: "オファー", start: "00:05", end: "00:25" }] },
  { id: "m-009", name: "ロゴ_BONNOU_白.png", summary: "BONNOUロゴ（白背景版）", kind: "画像", source: "提供", addedAt: "2026-03-15" },
  { id: "m-010", name: "BGM_落ち着き系02.mp3", summary: "権威性パートで使用する落ち着いた曲", kind: "BGM", source: "フリー", duration: "1:45", addedAt: "2026-03-15", usedSections: [{ label: "権威性パート", start: "00:10", end: "00:40" }] },
  { id: "m-011", name: "SE_キラキラ.mp3", summary: "ベネフィット表示時のキラキラ効果音", kind: "SE", source: "フリー", duration: "0:01", addedAt: "2026-03-14", usedSections: [{ label: "ベネフィット", start: "00:00", end: "00:01" }] },
  { id: "m-012", name: "SE_ドン.mp3", summary: "フック部分のインパクト効果音", kind: "SE", source: "提供", duration: "0:01", addedAt: "2026-03-14", usedSections: [{ label: "フック", start: "00:00", end: "00:01" }] },
];

const KIND_CONFIG: Record<MaterialKind, { icon: typeof Film; color: string; bg: string }> = {
  "動画": { icon: Film, color: "text-purple-600", bg: "bg-purple-50" },
  "画像": { icon: Image, color: "text-blue-600", bg: "bg-blue-50" },
  "BGM": { icon: Music, color: "text-amber-600", bg: "bg-amber-50" },
  "SE": { icon: Volume2, color: "text-emerald-600", bg: "bg-emerald-50" },
};

// ─── Main Page ────────────────────────────────────────
type MaterialsDraft = {
  search: string;
  kindFilter: MaterialKind | "";
  viewMode: "card" | "list";
  selectedId: string | null;
};

export default function MaterialsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [draft, setField] = usePageUndoDraft<MaterialsDraft>(
    () => ({ search: "", kindFilter: "", viewMode: "card", selectedId: null }),
    { mergeWindowMs: 400 },
  );
  const { search, kindFilter, viewMode, selectedId } = draft;
  const setSearch = (u: SetStateAction<string>) => setField("search", u);
  const setKindFilter = (u: SetStateAction<MaterialKind | "">) => setField("kindFilter", u);
  const setViewMode = (u: SetStateAction<"card" | "list">) => setField("viewMode", u);
  const setSelectedId = (u: SetStateAction<string | null>) => setField("selectedId", u);
  const selectedItem = MATERIALS.find((m) => m.id === selectedId);

  const filtered = MATERIALS.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.summary.toLowerCase().includes(search.toLowerCase())) return false;
    if (kindFilter && m.kind !== kindFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-lg font-bold text-[#1A1A2E] flex-1">素材一覧</h1>
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
              placeholder="素材名・内容で検索..."
              className="flex-1 text-[12px] text-[#1A1A2E]/70 bg-transparent outline-none placeholder:text-[#1A1A2E]/20" />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setKindFilter("")}
              className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all ${!kindFilter ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"}`}>
              すべて ({MATERIALS.length})
            </button>
            {(["動画", "画像", "BGM", "SE"] as MaterialKind[]).map((kind) => {
              const cfg = KIND_CONFIG[kind];
              const count = MATERIALS.filter((m) => m.kind === kind).length;
              return (
                <button key={kind} onClick={() => setKindFilter(kindFilter === kind ? "" : kind)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                    kindFilter === kind ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"
                  }`}>
                  <cfg.icon className="w-3 h-3" />
                  {kind} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Card View */}
        {viewMode === "card" && (
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const cfg = KIND_CONFIG[item.kind];
              const KindIcon = cfg.icon;
              return (
                <div key={item.id} onClick={() => setSelectedId(item.id)} className="bg-white rounded-xl border border-black/[0.06] overflow-hidden hover:shadow-md hover:border-[#9333EA]/20 transition-all cursor-pointer group">
                  <div className="relative bg-gradient-to-br from-[#1A1A2E]/5 to-[#9333EA]/5 flex items-center justify-center py-6">
                    <div className="w-[60px] h-[100px] rounded-xl border-2 border-[#1A1A2E]/10 bg-white flex items-center justify-center group-hover:border-[#9333EA]/30 transition-colors">
                      <KindIcon className={`w-6 h-6 ${cfg.color} opacity-40 group-hover:opacity-70 transition-opacity`} />
                    </div>
                    {item.duration && (
                      <span className="absolute bottom-2 right-2 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {item.duration}
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-[#1A1A2E]/80 truncate mb-0.5">{item.name}</p>
                    <p className="text-[9px] text-[#1A1A2E]/40 leading-relaxed mb-1.5 line-clamp-2">{item.summary}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{item.kind}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${SOURCE_STYLES[item.source].bg} ${SOURCE_STYLES[item.source].text}`}>{item.source}</span>
                      </div>
                      <span className="text-[9px] text-[#1A1A2E]/25 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {item.addedAt}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
              <div className="grid grid-cols-[50px_60px_70px_1fr_1fr_80px_100px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/50 uppercase tracking-wider">
                <div className="px-2 py-3"></div>
                <div className="px-2 py-3">種別</div>
                <div className="px-2 py-3">ソース</div>
                <div className="px-2 py-3">素材名</div>
                <div className="px-2 py-3">概要</div>
                <div className="px-2 py-3">尺</div>
                <div className="px-2 py-3">追加日</div>
              </div>
              {filtered.map((item) => {
                const cfg = KIND_CONFIG[item.kind];
                const ss = SOURCE_STYLES[item.source];
                const KindIcon = cfg.icon;
                return (
                  <div key={item.id} onClick={() => setSelectedId(item.id)} className="grid grid-cols-[50px_60px_70px_1fr_1fr_80px_100px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors cursor-pointer group">
                    <div className="px-2 py-3 flex items-center justify-center">
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                        <KindIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                    </div>
                    <div className="px-2 py-3 flex items-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${cfg.bg} ${cfg.color}`}>{item.kind}</span>
                    </div>
                    <div className="px-2 py-3 flex items-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${ss.bg} ${ss.text}`}>{item.source}</span>
                    </div>
                    <div className="px-2 py-3 flex flex-col justify-center min-w-0">
                      <p className="text-[12px] font-semibold text-[#1A1A2E]/80 truncate">{item.name}</p>
                    </div>
                    <div className="px-2 py-3 flex items-center">
                      <p className="text-[11px] text-[#1A1A2E]/40 truncate">{item.summary}</p>
                    </div>
                    <div className="px-2 py-3 flex items-center text-[11px] text-[#1A1A2E]/50">
                      {item.duration || "—"}
                    </div>
                    <div className="px-2 py-3 flex items-center text-[11px] text-[#1A1A2E]/40">
                      {item.addedAt}
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
            <p className="text-[13px] font-medium">素材が見つかりません</p>
          </div>
        )}
      </div>
      {/* Detail modal */}
      {selectedItem && (() => {
        const cfg = KIND_CONFIG[selectedItem.kind];
        const ss = SOURCE_STYLES[selectedItem.source];
        const KindIcon = cfg.icon;
        const hasTimeline = selectedItem.kind === "動画" || selectedItem.kind === "BGM" || selectedItem.kind === "SE";
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setSelectedId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Preview area */}
              <div className={`relative flex items-center justify-center ${
                selectedItem.kind === "動画" ? "aspect-video" : "py-10"
              } bg-gradient-to-br from-[#1a1a2e]/70 to-[#1a1a2e]/90`}>
                <KindIcon className="w-16 h-16 text-white/15" />
                {(selectedItem.kind === "動画" || selectedItem.kind === "BGM" || selectedItem.kind === "SE") && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                      <Play className="w-7 h-7 text-white ml-1" />
                    </div>
                  </div>
                )}
                {selectedItem.duration && (
                  <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-medium px-2 py-1 rounded">{selectedItem.duration}</div>
                )}
                <button onClick={() => setSelectedId(null)} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{selectedItem.kind}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${ss.bg} ${ss.text}`}>{selectedItem.source}</span>
                  <span className="text-[10px] text-[#1A1A2E]/30 ml-auto flex items-center gap-1"><Calendar className="w-3 h-3" />{selectedItem.addedAt}</span>
                </div>
                <h2 className="text-[16px] font-bold text-[#1A1A2E] mb-1">{selectedItem.name}</h2>
                <p className="text-[12px] text-[#1A1A2E]/50 leading-relaxed mb-4">{selectedItem.summary}</p>

                {/* Used sections (for 動画/BGM/SE) */}
                {hasTimeline && selectedItem.usedSections && selectedItem.usedSections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 font-bold mb-2">
                      <Scissors className="w-3 h-3" /> よく使われる利用箇所
                    </div>
                    <div className="space-y-1.5">
                      {selectedItem.usedSections.map((sec, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#FAF8F5] rounded-lg px-3 py-2">
                          <span className="text-[10px] font-bold text-[#9333EA] bg-[#9333EA]/[0.08] px-1.5 py-0.5 rounded whitespace-nowrap">{sec.label}</span>
                          <div className="flex-1 h-1.5 bg-[#1A1A2E]/[0.06] rounded-full relative overflow-hidden">
                            {/* Visual bar showing the used portion */}
                            {selectedItem.duration && (() => {
                              const parseSec = (t: string) => { const [m, s] = t.split(":").map(Number); return (m || 0) * 60 + (s || 0); };
                              const total = parseSec(selectedItem.duration);
                              const s = parseSec(sec.start);
                              const e = parseSec(sec.end);
                              if (total === 0) return null;
                              return <div className="absolute h-full bg-[#9333EA]/40 rounded-full" style={{ left: `${(s / total) * 100}%`, width: `${((e - s) / total) * 100}%` }} />;
                            })()}
                          </div>
                          <span className="text-[10px] text-[#1A1A2E]/40 font-mono whitespace-nowrap">{sec.start} 〜 {sec.end}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
