"use client";

import { use, useState, useCallback } from "react";
import { Plus, Trash2, Download, Camera, ListChecks, Smartphone, ArrowLeft, FolderOpen, MapPin, User, Clock, Shirt } from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type MaterialItem = {
  id: number;
  category: string;
  materialName: string;
  description: string;
  status: "未撮影" | "撮影済";
  imageLabel: string;
};

type ShootDay = {
  id: number;
  date: string;
  location: string;
  model: string;
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
  imageLabel: string;
};

// ─── Auto-classify category from description/name ────
function autoClassify(name: string, desc: string): string {
  const t = (name + " " + desc).toLowerCase();
  if (t.includes("リアクション") || t.includes("うなずき")) return "反応";
  if (t.includes("インタビュー") || t.includes("話者") || t.includes("正面") || t.includes("アングル")) return "取材";
  if (t.includes("pc") || t.includes("操作") || t.includes("ツール") || t.includes("商品") || t.includes("利用")) return "商品";
  if (t.includes("画面") || t.includes("録画") || t.includes("スクショ") || t.includes("スマホ")) return "録画";
  if (t.includes("成果") || t.includes("売上") || t.includes("フォロワー") || t.includes("ベネフィット")) return "実績";
  if (t.includes("ロゴ") || t.includes("素材")) return "素材";
  if (t.includes("ライフ") || t.includes("日常")) return "日常";
  return "その他";
}

// ─── Sample Data ──────────────────────────────────────
let _nextId = 600;
function nextId() { return _nextId++; }

function makeMaterials(): MaterialItem[] {
  const raw = [
    { name: "インタビュー素材A", desc: "話者の正面カット", status: "未撮影" as const, img: "正面バストアップ" },
    { name: "インタビュー素材B", desc: "話者の別アングル", status: "未撮影" as const, img: "斜め45度バストアップ" },
    { name: "インタビュー素材C", desc: "話者のリアクション", status: "撮影済" as const, img: "寄りリアクション" },
    { name: "PC操作画面", desc: "AIツール使用シーン", status: "未撮影" as const, img: "俯瞰PC操作" },
    { name: "スマホ画面録画", desc: "SNS投稿の実績画面", status: "未撮影" as const, img: "縦画面スマホ録画" },
    { name: "成果画面スクショ", desc: "売上・フォロワー数の画面", status: "撮影済" as const, img: "数値アップ画面" },
    { name: "ロゴ素材", desc: "DOT-AI BOOTCAMPロゴ", status: "撮影済" as const, img: "ロゴ単体" },
  ];
  return raw.map((r) => ({
    id: nextId(),
    category: autoClassify(r.name, r.desc),
    materialName: r.name,
    description: r.desc,
    status: r.status,
    imageLabel: r.img,
  }));
}

const INITIAL_DAYS: ShootDay[] = [
  {
    id: nextId(), date: "2026/04/01", location: "スタジオA", model: "出演者A",
    rows: [
      { id: nextId(), materialName: "インタビュー素材A", shootContent: "話者正面インタビュー", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", shootTime: "10:00-10:30", props: "マイク", note: "自然光を活用", imageLabel: "正面バストアップ" },
      { id: nextId(), materialName: "インタビュー素材B", shootContent: "話者別アングル", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", shootTime: "10:30-11:00", props: "マイク", note: "", imageLabel: "斜め45度" },
      { id: nextId(), materialName: "インタビュー素材C", shootContent: "リアクション・うなずき", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", shootTime: "11:00-11:15", props: "", note: "寄りカット多め", imageLabel: "寄りリアクション" },
      { id: nextId(), materialName: "PC操作画面", shootContent: "AIツール操作デモ", location: "デスク", cast: "出演者A", costume: "同上", shootTime: "11:30-12:00", props: "PC・モニター", note: "画面録画も同時に", imageLabel: "俯瞰PC操作" },
    ],
  },
  {
    id: nextId(), date: "2026/04/02", location: "デスク", model: "—",
    rows: [
      { id: nextId(), materialName: "スマホ画面録画", shootContent: "SNS投稿実績の画面録画", location: "デスク", cast: "", costume: "", shootTime: "10:00-10:15", props: "スマホ", note: "縦画面で録画", imageLabel: "スマホ縦画面" },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────
export default function ShootingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [activeTab, setActiveTab] = useState<"materials" | "callsheet">("materials");
  const [materials, setMaterials] = useState<MaterialItem[]>(makeMaterials);
  const [days, setDays] = useState<ShootDay[]>(INITIAL_DAYS);
  const [statusFilter, setStatusFilter] = useState<"all" | "未撮影" | "撮影済">("all");
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);

  // Material handlers
  const updateMaterial = useCallback((id: number, field: string, value: any) => {
    setMaterials((prev) => prev.map((m) => {
      const updated = m.id === id ? { ...m, [field]: value } : m;
      if (m.id === id && (field === "materialName" || field === "description")) {
        return { ...updated, category: autoClassify(
          field === "materialName" ? value : updated.materialName,
          field === "description" ? value : updated.description
        )};
      }
      return updated;
    }));
  }, []);
  const addMaterial = useCallback(() => {
    setMaterials((prev) => [...prev, { id: nextId(), category: "その他", materialName: "", description: "", status: "未撮影", imageLabel: "" }]);
  }, []);
  const removeMaterial = useCallback((id: number) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Callsheet handlers
  const addDay = useCallback(() => {
    setDays((prev) => [...prev, { id: nextId(), date: "", location: "", model: "", rows: [] }]);
  }, []);
  const updateDay = useCallback((dayId: number, field: string, value: string) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, [field]: value } : d));
  }, []);
  const addRow = useCallback((dayId: number) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, rows: [...d.rows, { id: nextId(), materialName: "", shootContent: "", location: "", cast: "", costume: "", shootTime: "", props: "", note: "", imageLabel: "" }] } : d));
  }, []);
  const updateRow = useCallback((dayId: number, rowId: number, field: string, value: string) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, rows: d.rows.map((r) => r.id === rowId ? { ...r, [field]: value } : r) } : d));
  }, []);
  const removeRow = useCallback((dayId: number, rowId: number) => {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, rows: d.rows.filter((r) => r.id !== rowId) } : d));
  }, []);

  const filteredMaterials = materials.filter((m) => statusFilter === "all" || m.status === statusFilter);
  const selectedDay = days.find((d) => d.id === selectedDayId);

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Tabs */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 flex gap-0">
          {[
            { key: "materials" as const, label: "必要素材リスト", icon: ListChecks },
            { key: "callsheet" as const, label: "香盤票", icon: Camera },
          ].map((tab) => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedDayId(null); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-all ${
                activeTab === tab.key ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
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
              <div className="grid grid-cols-[90px_1fr_1fr_110px_80px_36px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/50 uppercase tracking-wider">
                <div className="px-3 py-3">分類</div>
                <div className="px-2 py-3">素材名</div>
                <div className="px-2 py-3">説明</div>
                <div className="px-2 py-3">素材イメージ</div>
                <div className="px-2 py-3">ステータス</div>
                <div className="px-2 py-3"></div>
              </div>
              {filteredMaterials.map((item) => (
                <div key={item.id} className={`grid grid-cols-[90px_1fr_1fr_110px_80px_36px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors group ${
                  item.status === "撮影済" ? "bg-emerald-50/20" : ""
                }`}>
                  <div className="px-3 py-3 flex items-center">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#9333EA]/[0.08] text-[#9333EA] whitespace-nowrap">{item.category}</span>
                  </div>
                  <div className="px-2 py-3 flex items-center">
                    <input value={item.materialName} onChange={(e) => updateMaterial(item.id, "materialName", e.target.value)}
                      placeholder="素材名" className="w-full text-[12px] text-[#1A1A2E]/80 font-medium bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/20" />
                  </div>
                  <div className="px-2 py-3 flex items-center">
                    <input value={item.description} onChange={(e) => updateMaterial(item.id, "description", e.target.value)}
                      placeholder="撮影内容の説明" className="w-full text-[11px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/15" />
                  </div>
                  <div className="px-2 py-2 flex flex-col items-center justify-center">
                    <div className="w-[44px] aspect-[9/16] rounded-[4px] border border-black/[0.08] bg-gradient-to-b from-[#1a1a2e]/5 to-[#1a1a2e]/15 flex items-center justify-center overflow-hidden">
                      <Smartphone className="w-3 h-3 text-[#1A1A2E]/15" />
                    </div>
                    <p className="text-[8px] text-[#1A1A2E]/30 text-center mt-0.5 truncate max-w-[100px]">{item.imageLabel || "未設定"}</p>
                  </div>
                  <div className="px-2 py-3 flex items-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      item.status === "撮影済" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>{item.status}</span>
                  </div>
                  <div className="px-1 py-3 flex items-center">
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

        {/* ── 香盤票: フォルダ選択 ── */}
        {activeTab === "callsheet" && !selectedDay && (
          <div className="max-w-4xl mx-auto">
            <p className="text-[12px] text-[#1A1A2E]/40 mb-4">撮影日を選択してください</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {days.map((day) => (
                <button key={day.id} onClick={() => setSelectedDayId(day.id)}
                  className="bg-white rounded-2xl border border-black/[0.06] p-5 hover:shadow-lg hover:border-[#9333EA]/20 transition-all text-left group">
                  <div className="w-12 h-12 rounded-full bg-[#9333EA]/[0.08] flex items-center justify-center mb-3 group-hover:bg-[#9333EA]/15 transition-colors">
                    <FolderOpen className="w-5 h-5 text-[#9333EA]" />
                  </div>
                  <h3 className="text-[14px] font-bold text-[#1A1A2E]/80 mb-2 group-hover:text-[#9333EA] transition-colors">
                    {day.date || "日付未定"}
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#1A1A2E]/40">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{day.location || "場所未定"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#1A1A2E]/40">
                      <User className="w-3 h-3 shrink-0" />
                      <span>{day.model || "モデル未定"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#1A1A2E]/30">
                      <Camera className="w-3 h-3 shrink-0" />
                      <span>{day.rows.length}カット</span>
                    </div>
                  </div>
                </button>
              ))}
              {/* Add day */}
              <button onClick={addDay}
                className="bg-white/50 rounded-2xl border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.02] transition-all flex flex-col items-center justify-center gap-2 text-[#1A1A2E]/20 hover:text-[#9333EA]/50 min-h-[180px]">
                <Plus className="w-6 h-6" />
                <span className="text-[11px] font-medium">撮影日を追加</span>
              </button>
            </div>
          </div>
        )}

        {/* ── 香盤票: 撮影日の詳細（左グループ + 右カード） ── */}
        {activeTab === "callsheet" && selectedDay && (() => {
          // Group rows by location + cast + costume
          type LeftGroup = { location: string; cast: string; costume: string; timeRange: string; rows: CallSheetRow[] };
          const groups: LeftGroup[] = [];
          selectedDay.rows.forEach((row) => {
            const last = groups[groups.length - 1];
            if (last && last.location === row.location && last.cast === row.cast && last.costume === row.costume) {
              last.rows.push(row);
              const endTime = row.shootTime.split("-")[1] || row.shootTime;
              last.timeRange = last.timeRange.split("-")[0] + "-" + endTime;
            } else {
              groups.push({ location: row.location, cast: row.cast, costume: row.costume, timeRange: row.shootTime, rows: [row] });
            }
          });

          return (
            <div className="max-w-5xl mx-auto">
              {/* Back + header */}
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setSelectedDayId(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] text-[#1A1A2E]/30 hover:text-[#9333EA] transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <input value={selectedDay.date} onChange={(e) => updateDay(selectedDay.id, "date", e.target.value)}
                    className="text-[16px] font-bold text-[#1A1A2E]/80 bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none" />
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-[#1A1A2E]/40">
                    <span>{selectedDay.rows.length}カット</span>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.03] text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] transition-all">
                  <Download className="w-3.5 h-3.5" /> ダウンロード
                </button>
              </div>

              {/* Groups: left info + right cards */}
              <div className="space-y-6">
                {groups.map((group, gi) => (
                  <div key={gi} className="flex gap-0 bg-white rounded-xl border border-black/[0.06] overflow-hidden">
                    {/* Left: shared info with connecting line */}
                    <div className="w-[180px] shrink-0 bg-[#FAFAF8] border-r border-black/[0.06] p-4 flex flex-col">
                      <div className="flex items-start gap-2 flex-1">
                        {/* Connecting line */}
                        <div className={`w-1 shrink-0 rounded-full mt-1 ${group.rows.length > 1 ? "bg-[#9333EA]/30" : "bg-[#1A1A2E]/10"}`}
                          style={{ minHeight: "100%" }} />
                        <div className="flex-1 space-y-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 mb-0.5">
                              <Clock className="w-3 h-3" /><span className="font-medium">時間</span>
                            </div>
                            <p className="text-[12px] text-[#1A1A2E]/70 font-semibold">{group.timeRange || "未定"}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 mb-0.5">
                              <MapPin className="w-3 h-3" /><span className="font-medium">場所</span>
                            </div>
                            <input value={group.location} onChange={(e) => {
                              group.rows.forEach((r) => updateRow(selectedDay.id, r.id, "location", e.target.value));
                            }} placeholder="場所" className="text-[12px] text-[#1A1A2E]/70 bg-transparent border-b border-transparent hover:border-black/[0.1] focus:border-[#9333EA]/40 outline-none w-full" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 mb-0.5">
                              <User className="w-3 h-3" /><span className="font-medium">出演者</span>
                            </div>
                            <input value={group.cast} onChange={(e) => {
                              group.rows.forEach((r) => updateRow(selectedDay.id, r.id, "cast", e.target.value));
                            }} placeholder="出演者" className="text-[12px] text-[#1A1A2E]/70 bg-transparent border-b border-transparent hover:border-black/[0.1] focus:border-[#9333EA]/40 outline-none w-full" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A2E]/30 mb-0.5">
                              <Shirt className="w-3 h-3" /><span className="font-medium">衣装</span>
                            </div>
                            <input value={group.costume} onChange={(e) => {
                              group.rows.forEach((r) => updateRow(selectedDay.id, r.id, "costume", e.target.value));
                            }} placeholder="衣装" className="text-[12px] text-[#1A1A2E]/70 bg-transparent border-b border-transparent hover:border-black/[0.1] focus:border-[#9333EA]/40 outline-none w-full" />
                          </div>
                          {group.rows.length > 1 && (
                            <p className="text-[9px] text-[#9333EA]/50 font-bold mt-1">{group.rows.length}カット連続</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: cards per row */}
                    <div className="flex-1 p-3 space-y-3">
                      {group.rows.map((row, ri) => {
                        const globalIdx = selectedDay.rows.indexOf(row);
                        return (
                          <div key={row.id} className="flex gap-3 bg-[#FAF8F5] rounded-lg border border-black/[0.04] p-3 group/card hover:border-[#9333EA]/15 transition-all relative">
                            <button onClick={() => removeRow(selectedDay.id, row.id)}
                              className="absolute top-2 right-2 text-[#1A1A2E]/10 hover:text-red-400 opacity-0 group-hover/card:opacity-100 transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {/* Image */}
                            <div className="w-[56px] shrink-0 flex flex-col items-center">
                              <div className="w-[48px] aspect-[9/16] rounded-[4px] border border-black/[0.08] bg-gradient-to-b from-white/50 to-[#1a1a2e]/10 flex items-center justify-center">
                                <Smartphone className="w-3 h-3 text-[#1A1A2E]/15" />
                              </div>
                              <p className="text-[7px] text-[#1A1A2E]/20 text-center mt-0.5 leading-tight">{row.imageLabel || "イメージ"}</p>
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <span className="text-[8px] text-[#1A1A2E]/20 font-bold">#{String(globalIdx + 1).padStart(2, "0")}</span>
                              <input value={row.materialName} onChange={(e) => updateRow(selectedDay.id, row.id, "materialName", e.target.value)}
                                placeholder="素材名" className="block text-[13px] text-[#1A1A2E]/80 font-bold bg-transparent border-b border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 outline-none w-full" />
                              <input value={row.shootContent} onChange={(e) => updateRow(selectedDay.id, row.id, "shootContent", e.target.value)}
                                placeholder="撮影内容" className="block text-[11px] text-[#1A1A2E]/50 bg-transparent border-b border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 outline-none w-full mt-1" />
                              <div className="flex gap-3 mt-1.5 text-[10px] text-[#1A1A2E]/35">
                                <span>小道具: <input value={row.props} onChange={(e) => updateRow(selectedDay.id, row.id, "props", e.target.value)}
                                  placeholder="—" className="text-[#1A1A2E]/50 bg-transparent border-b border-transparent hover:border-black/[0.06] focus:border-[#9333EA]/40 outline-none w-[80px] inline" /></span>
                                <span>備考: <input value={row.note} onChange={(e) => updateRow(selectedDay.id, row.id, "note", e.target.value)}
                                  placeholder="—" className="text-[#1A1A2E]/50 bg-transparent border-b border-transparent hover:border-black/[0.06] focus:border-[#9333EA]/40 outline-none w-[100px] inline" /></span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => addRow(selectedDay.id)}
                className="w-full py-4 mt-4 text-[11px] text-[#1A1A2E]/25 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] rounded-xl border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 transition-all flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> カットを追加
              </button>
            </div>
          );
        })()}
      </div>

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
