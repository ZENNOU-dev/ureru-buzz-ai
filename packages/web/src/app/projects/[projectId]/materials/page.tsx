"use client";

import { use, useState } from "react";
import { Search, Film, Image, Music, Calendar, Clock, Smartphone } from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type MaterialKind = "動画" | "画像" | "音声";
type MaterialCategory = "メイン素材" | "サブ素材";

type MaterialItem = {
  id: string;
  name: string;
  kind: MaterialKind;
  category: MaterialCategory;
  duration?: string;
  addedAt: string;
  thumbnail?: string;
};

// ─── Sample Data ──────────────────────────────────────
const MATERIALS: MaterialItem[] = [
  { id: "m-001", name: "AI副業_メイン訴求A.mp4", kind: "動画", category: "メイン素材", duration: "0:32", addedAt: "2026-03-20" },
  { id: "m-002", name: "フリーランス体験談_B.mp4", kind: "動画", category: "メイン素材", duration: "0:28", addedAt: "2026-03-19" },
  { id: "m-003", name: "女性2.0_インタビュー.mp4", kind: "動画", category: "メイン素材", duration: "0:45", addedAt: "2026-03-18" },
  { id: "m-004", name: "サムネイル_AI副業.png", kind: "画像", category: "サブ素材", addedAt: "2026-03-20" },
  { id: "m-005", name: "テロップ背景_グラデ.png", kind: "画像", category: "サブ素材", addedAt: "2026-03-19" },
  { id: "m-006", name: "BGM_アップテンポ01.mp3", kind: "音声", category: "サブ素材", duration: "1:20", addedAt: "2026-03-17" },
  { id: "m-007", name: "SE_決定音.mp3", kind: "音声", category: "サブ素材", duration: "0:02", addedAt: "2026-03-17" },
  { id: "m-008", name: "特典推し_撮影素材.mp4", kind: "動画", category: "メイン素材", duration: "0:38", addedAt: "2026-03-16" },
  { id: "m-009", name: "ロゴ_BONNOU_白.png", kind: "画像", category: "サブ素材", addedAt: "2026-03-15" },
  { id: "m-010", name: "ナレーション_導入.mp3", kind: "音声", category: "サブ素材", duration: "0:15", addedAt: "2026-03-15" },
];

const KIND_CONFIG: Record<MaterialKind, { icon: typeof Film; color: string; bg: string }> = {
  "動画": { icon: Film, color: "text-purple-600", bg: "bg-purple-50" },
  "画像": { icon: Image, color: "text-blue-600", bg: "bg-blue-50" },
  "音声": { icon: Music, color: "text-amber-600", bg: "bg-amber-50" },
};

// ─── Main Page ────────────────────────────────────────
export default function MaterialsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<MaterialKind | "">("");

  const filtered = MATERIALS.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (kindFilter && m.kind !== kindFilter) return false;
    return true;
  });

  const mainItems = filtered.filter((m) => m.category === "メイン素材");
  const subItems = filtered.filter((m) => m.category === "サブ素材");

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0 px-6 py-4">
        <h1 className="text-lg font-bold text-[#1A1A2E] mb-3">素材一覧</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 bg-[#FAF8F5] rounded-xl border border-black/[0.06] px-3 py-2">
            <Search className="w-4 h-4 text-[#1A1A2E]/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="素材名で検索..."
              className="flex-1 text-[12px] text-[#1A1A2E]/70 bg-transparent outline-none placeholder:text-[#1A1A2E]/20"
            />
          </div>
          {/* Filters */}
          <div className="flex gap-1">
            <button
              onClick={() => setKindFilter("")}
              className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all ${!kindFilter ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"}`}
            >
              すべて
            </button>
            {(["動画", "画像", "音声"] as MaterialKind[]).map((kind) => {
              const cfg = KIND_CONFIG[kind];
              return (
                <button
                  key={kind}
                  onClick={() => setKindFilter(kindFilter === kind ? "" : kind)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                    kindFilter === kind ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"
                  }`}
                >
                  <cfg.icon className="w-3 h-3" />
                  {kind}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Main Materials */}
        {mainItems.length > 0 && (
          <section>
            <h2 className="text-[13px] font-bold text-[#1A1A2E]/70 mb-3 flex items-center gap-2">
              <Film className="w-4 h-4 text-[#9333EA]" />
              メイン素材
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#9333EA]/10 text-[#9333EA]">{mainItems.length}</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mainItems.map((item) => (
                <MaterialCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Sub Materials */}
        {subItems.length > 0 && (
          <section>
            <h2 className="text-[13px] font-bold text-[#1A1A2E]/70 mb-3 flex items-center gap-2">
              <Image className="w-4 h-4 text-[#9333EA]" />
              サブ素材
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#9333EA]/10 text-[#9333EA]">{subItems.length}</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {subItems.map((item) => (
                <MaterialCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#1A1A2E]/20">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-[13px] font-medium">素材が見つかりません</p>
          </div>
        )}
      </div>
      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}

// ─── Material Card ────────────────────────────────────
function MaterialCard({ item }: { item: MaterialItem }) {
  const cfg = KIND_CONFIG[item.kind];
  const KindIcon = cfg.icon;

  return (
    <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden hover:shadow-md hover:border-[#9333EA]/20 transition-all cursor-pointer group">
      {/* Thumbnail - smartphone mock */}
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
      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-[11px] font-semibold text-[#1A1A2E]/80 truncate mb-1.5">{item.name}</p>
        <div className="flex items-center justify-between">
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{item.kind}</span>
          <span className="text-[9px] text-[#1A1A2E]/25 flex items-center gap-0.5">
            <Calendar className="w-2.5 h-2.5" />
            {item.addedAt}
          </span>
        </div>
      </div>
    </div>
  );
}
