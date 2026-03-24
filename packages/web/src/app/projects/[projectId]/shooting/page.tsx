"use client";

import { use, useState, useCallback } from "react";
import { Plus, Trash2, Download, Camera, ListChecks, Smartphone, ChevronRight, FolderOpen } from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type MaterialItem = {
  id: number;
  category: string; // 撮影用分類
  materialName: string;
  description: string;
  status: "未撮影" | "撮影済";
  angleImageLabel: string; // アングルイメージの説明
};

type ShootDay = {
  id: number;
  date: string;
  label: string;
  rows: CallSheetRow[];
};

type CallSheetRow = {
  id: number;
  materialName: string;
  shootContent: string;
  location: string;
  cast: string;
  costume: string;
  shootTime: string;
  props: string;
  note: string;
  angleImageLabel: string;
};

// ─── Constants ────────────────────────────────────────
const CATEGORIES = ["インタビュー", "商品利用", "ライフスタイル", "ベネフィット", "リアクション", "画面録画", "ロゴ・素材", "その他"];

// ─── Sample Data ──────────────────────────────────────
let _nextId = 600;
function nextId() { return _nextId++; }

const INITIAL_MATERIALS: MaterialItem[] = [
  { id: nextId(), category: "インタビュー", materialName: "インタビュー素材A", description: "話者の正面カット", status: "未撮影", angleImageLabel: "正面バストアップ" },
  { id: nextId(), category: "インタビュー", materialName: "インタビュー素材B", description: "話者の別アングル", status: "未撮影", angleImageLabel: "斜め45度バストアップ" },
  { id: nextId(), category: "リアクション", materialName: "インタビュー素材C", description: "話者のリアクション", status: "撮影済", angleImageLabel: "寄りリアクション" },
  { id: nextId(), category: "商品利用", materialName: "PC操作画面", description: "AIツール使用シーン", status: "未撮影", angleImageLabel: "俯瞰PC操作" },
  { id: nextId(), category: "画面録画", materialName: "スマホ画面録画", description: "SNS投稿の実績画面", status: "未撮影", angleImageLabel: "縦画面スマホ録画" },
  { id: nextId(), category: "ベネフィット", materialName: "成果画面スクショ", description: "売上・フォロワー数の画面", status: "撮影済", angleImageLabel: "数値アップ画面" },
  { id: nextId(), category: "ロゴ・素材", materialName: "ロゴ素材", description: "DOT-AI BOOTCAMPロゴ", status: "撮影済", angleImageLabel: "ロゴ単体" },
];

const INITIAL_DAYS: ShootDay[] = [
  {
    id: nextId(), date: "2026/04/01", label: "撮影日1: スタジオ撮影",
    rows: [
      { id: nextId(), materialName: "インタビュー素材A", shootContent: "話者正面インタビュー", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", shootTime: "10:00-10:30", props: "マイク", note: "自然光を活用", angleImageLabel: "正面バストアップ" },
      { id: nextId(), materialName: "インタビュー素材B", shootContent: "話者別アングルインタビュー", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", shootTime: "10:30-11:00", props: "マイク", note: "", angleImageLabel: "斜め45度" },
      { id: nextId(), materialName: "インタビュー素材C", shootContent: "リアクション・うなずき", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", shootTime: "11:00-11:15", props: "", note: "寄りカット多め", angleImageLabel: "寄りリアクション" },
      { id: nextId(), materialName: "PC操作画面", shootContent: "AIツール操作デモ", location: "デスク", cast: "出演者A", costume: "同上", shootTime: "11:30-12:00", props: "PC・モニター", note: "画面録画も同時に", angleImageLabel: "俯瞰PC操作" },
    ],
  },
  {
    id: nextId(), date: "2026/04/02", label: "撮影日2: 画面収録",
    rows: [
      { id: nextId(), materialName: "スマホ画面録画", shootContent: "SNS投稿実績の画面録画", location: "デスク", cast: "", costume: "", shootTime: "10:00-10:15", props: "スマホ", note: "縦画面で録画", angleImageLabel: "スマホ縦画面" },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────
export default function ShootingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [activeTab, setActiveTab] = useState<"materials" | "callsheet">("materials");
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const [days, setDays] = useState<ShootDay[]>(INITIAL_DAYS);
  const [statusFilter, setStatusFilter] = useState<"all" | "未撮影" | "撮影済">("all");

  // Material handlers
  const updateMaterial = useCallback((id: number, field: string, value: any) => {
    setMaterials((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  }, []);
  const addMaterial = useCallback(() => {
    setMaterials((prev) => [...prev, { id: nextId(), category: "その他", materialName: "", description: "", status: "未撮影", angleImageLabel: "" }]);
  }, []);
  const removeMaterial = useCallback((id: number) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Callsheet handlers
  const addDay = useCallback(() => {
    setDays((prev) => [...prev, { id: nextId(), date: "", label: `撮影日${prev.length + 1}`, rows: [] }]);
  }, []);
  const updateDay = useCallback((dayId: number, field: string, value: string) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, [field]: value } : d));
  }, []);
  const addRow = useCallback((dayId: number) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, rows: [...d.rows, { id: nextId(), materialName: "", shootContent: "", location: "", cast: "", costume: "", shootTime: "", props: "", note: "", angleImageLabel: "" }] } : d));
  }, []);
  const updateRow = useCallback((dayId: number, rowId: number, field: string, value: string) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, rows: d.rows.map((r) => r.id === rowId ? { ...r, [field]: value } : r) } : d));
  }, []);
  const removeRow = useCallback((dayId: number, rowId: number) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, rows: d.rows.filter((r) => r.id !== rowId) } : d));
  }, []);

  const filteredMaterials = materials.filter((m) => statusFilter === "all" || m.status === statusFilter);

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        {/* Tabs */}
        <div className="px-6 flex gap-0">
          {[
            { key: "materials" as const, label: "必要素材リスト", icon: ListChecks },
            { key: "callsheet" as const, label: "香盤票", icon: Camera },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-all ${
                activeTab === tab.key ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
          {activeTab === "callsheet" && (
            <div className="ml-auto flex items-center">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.03] text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] transition-all">
                <Download className="w-3.5 h-3.5" /> 香盤票ダウンロード
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* ── 必要素材リスト ── */}
        {activeTab === "materials" && (
          <div className="max-w-5xl mx-auto">
            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              {(["all", "未撮影", "撮影済"] as const).map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${
                    statusFilter === f ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"
                  }`}>
                  {f === "all" ? `すべて (${materials.length})` : `${f} (${materials.filter((m) => m.status === f).length})`}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[100px_1fr_1fr_120px_80px_40px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/40 uppercase tracking-wider">
                <div className="px-3 py-3">分類</div>
                <div className="px-2 py-3">素材名</div>
                <div className="px-2 py-3">説明</div>
                <div className="px-2 py-3">アングルイメージ</div>
                <div className="px-2 py-3">ステータス</div>
                <div className="px-2 py-3"></div>
              </div>
              {filteredMaterials.map((item) => (
                <div key={item.id} className={`grid grid-cols-[100px_1fr_1fr_120px_80px_40px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors group ${
                  item.status === "未撮影" ? "" : "bg-emerald-50/20"
                }`}>
                  <div className="px-3 py-3">
                    <select value={item.category} onChange={(e) => updateMaterial(item.id, "category", e.target.value)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#9333EA]/[0.06] text-[#9333EA] cursor-pointer outline-none w-full">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="px-2 py-3">
                    <input value={item.materialName} onChange={(e) => updateMaterial(item.id, "materialName", e.target.value)}
                      placeholder="素材名" className="w-full text-[12px] text-[#1A1A2E]/80 font-medium bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/20" />
                  </div>
                  <div className="px-2 py-3">
                    <input value={item.description} onChange={(e) => updateMaterial(item.id, "description", e.target.value)}
                      placeholder="撮影内容の説明" className="w-full text-[11px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/15" />
                  </div>
                  <div className="px-2 py-2">
                    <div className="w-[52px] aspect-[9/16] rounded-[4px] border border-black/[0.08] bg-gradient-to-b from-[#1a1a2e]/5 to-[#1a1a2e]/15 flex items-center justify-center overflow-hidden mx-auto">
                      <Smartphone className="w-3 h-3 text-[#1A1A2E]/15" />
                    </div>
                    <p className="text-[8px] text-[#1A1A2E]/30 text-center mt-0.5 truncate">{item.angleImageLabel || "未設定"}</p>
                  </div>
                  <div className="px-2 py-3 flex items-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      item.status === "撮影済" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>{item.status}</span>
                  </div>
                  <div className="px-2 py-3 flex items-center">
                    <button onClick={() => removeMaterial(item.id)}
                      className="text-[#1A1A2E]/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addMaterial}
                className="w-full py-3 text-[11px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] flex items-center justify-center gap-1 transition-all">
                <Plus className="w-3 h-3" /> 素材を追加
              </button>
            </div>
          </div>
        )}

        {/* ── 香盤票 ── */}
        {activeTab === "callsheet" && (
          <div className="max-w-6xl mx-auto space-y-6">
            {days.map((day) => {
              // Group rows by shared location/cast/costume for line-connecting
              const leftGroups: { location: string; cast: string; costume: string; time: string; rows: CallSheetRow[] }[] = [];
              day.rows.forEach((row) => {
                const last = leftGroups[leftGroups.length - 1];
                if (last && last.location === row.location && last.cast === row.cast && last.costume === row.costume) {
                  last.rows.push(row);
                  last.time = last.time.split("-")[0] + "-" + (row.shootTime.split("-")[1] || row.shootTime);
                } else {
                  leftGroups.push({ location: row.location, cast: row.cast, costume: row.costume, time: row.shootTime, rows: [row] });
                }
              });

              return (
                <div key={day.id} className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
                  {/* Day header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-[#FAF8F5] border-b border-black/[0.06]">
                    <FolderOpen className="w-4 h-4 text-[#9333EA]/50" />
                    <input value={day.date} onChange={(e) => updateDay(day.id, "date", e.target.value)}
                      placeholder="2026/04/01" className="text-[13px] font-bold text-[#1A1A2E]/80 bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none w-[120px]" />
                    <input value={day.label} onChange={(e) => updateDay(day.id, "label", e.target.value)}
                      placeholder="撮影日の説明" className="text-[12px] text-[#1A1A2E]/50 bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none flex-1" />
                  </div>

                  {/* Content: left (grouped info) + right (cards) */}
                  <div className="flex">
                    {/* Left: location/cast/costume grouped with connecting lines */}
                    <div className="w-[220px] shrink-0 border-r border-black/[0.06] bg-[#FAFAF8]">
                      {leftGroups.map((group, gi) => (
                        <div key={gi} className={`px-4 py-3 ${gi > 0 ? "border-t border-black/[0.04]" : ""}`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-1 shrink-0 rounded-full ${group.rows.length > 1 ? "bg-[#9333EA]/30" : "bg-[#1A1A2E]/10"}`}
                              style={{ height: `${group.rows.length * 80}px`, minHeight: "24px" }} />
                            <div className="flex-1 space-y-1.5">
                              <div className="text-[10px] text-[#1A1A2E]/30 font-medium">{group.time}</div>
                              <div className="text-[11px] text-[#1A1A2E]/70 font-semibold">{group.location || "場所未定"}</div>
                              {group.cast && <div className="text-[10px] text-[#1A1A2E]/50">出演: {group.cast}</div>}
                              {group.costume && <div className="text-[10px] text-[#1A1A2E]/40">衣装: {group.costume}</div>}
                              {group.rows.length > 1 && (
                                <div className="text-[9px] text-[#9333EA]/50 font-medium">{group.rows.length}カット連続</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right: cards per row */}
                    <div className="flex-1 p-3">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {day.rows.map((row) => (
                          <div key={row.id} className="bg-[#FAF8F5] rounded-lg border border-black/[0.04] p-3 group/card hover:border-[#9333EA]/20 transition-all relative">
                            <button onClick={() => removeRow(day.id, row.id)}
                              className="absolute top-1.5 right-1.5 text-[#1A1A2E]/10 hover:text-red-400 opacity-0 group-hover/card:opacity-100 transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {/* Angle image */}
                            <div className="w-[48px] aspect-[9/16] rounded-[4px] border border-black/[0.08] bg-gradient-to-b from-[#1a1a2e]/5 to-[#1a1a2e]/15 flex items-center justify-center overflow-hidden mb-2 mx-auto">
                              <Smartphone className="w-3 h-3 text-[#1A1A2E]/15" />
                            </div>
                            <p className="text-[8px] text-[#1A1A2E]/25 text-center mb-2">{row.angleImageLabel || "撮影イメージ"}</p>
                            <input value={row.materialName} onChange={(e) => updateRow(day.id, row.id, "materialName", e.target.value)}
                              placeholder="素材名" className="w-full text-[11px] text-[#1A1A2E]/80 font-semibold bg-transparent border-b border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 outline-none mb-1 text-center" />
                            <input value={row.shootContent} onChange={(e) => updateRow(day.id, row.id, "shootContent", e.target.value)}
                              placeholder="撮影内容" className="w-full text-[10px] text-[#1A1A2E]/50 bg-transparent border-b border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 outline-none mb-1 text-center" />
                            {(row.props || true) && (
                              <input value={row.props} onChange={(e) => updateRow(day.id, row.id, "props", e.target.value)}
                                placeholder="小道具" className="w-full text-[9px] text-[#1A1A2E]/35 bg-transparent border-b border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 outline-none mb-1 text-center" />
                            )}
                            <input value={row.note} onChange={(e) => updateRow(day.id, row.id, "note", e.target.value)}
                              placeholder="備考" className="w-full text-[9px] text-[#1A1A2E]/30 bg-transparent border-b border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 outline-none text-center" />
                          </div>
                        ))}
                        <button onClick={() => addRow(day.id)}
                          className="bg-white/50 rounded-lg border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.02] transition-all flex flex-col items-center justify-center gap-1 text-[#1A1A2E]/20 hover:text-[#9333EA]/50 min-h-[140px]">
                          <Plus className="w-4 h-4" />
                          <span className="text-[9px]">カット追加</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add day */}
            <button onClick={addDay}
              className="w-full py-4 text-[11px] text-[#1A1A2E]/25 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] rounded-xl border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 transition-all flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> 撮影日を追加
            </button>
          </div>
        )}
      </div>

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
