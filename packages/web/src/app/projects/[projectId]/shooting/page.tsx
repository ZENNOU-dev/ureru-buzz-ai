"use client";

import { use, useState, useCallback } from "react";
import { ArrowLeft, Plus, X, Camera, ListChecks, CheckCircle2, Circle, Trash2, Download } from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type MaterialItem = {
  id: number;
  sceneName: string;
  materialName: string;
  materialType: "メイン" | "サブ";
  description: string;
  status: "未撮影" | "撮影済" | "編集済";
};

type CallSheetRow = {
  id: number;
  sceneNo: string;
  materialName: string;
  shootContent: string;
  location: string;
  cast: string;
  costume: string;
  props: string;
  shootTime: string;
  note: string;
};

// ─── Constants ────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  "未撮影": { bg: "bg-gray-100", text: "text-gray-500" },
  "撮影済": { bg: "bg-amber-50", text: "text-amber-700" },
  "編集済": { bg: "bg-emerald-50", text: "text-emerald-700" },
};

// ─── Sample Data (auto-extracted from edit-brief) ─────
let _nextId = 500;
function nextId() { return _nextId++; }

const INITIAL_MATERIALS: MaterialItem[] = [
  { id: nextId(), sceneName: "フック1", materialName: "インタビュー素材A", materialType: "メイン", description: "話者の正面カット", status: "未撮影" },
  { id: nextId(), sceneName: "フック2", materialName: "インタビュー素材B", materialType: "メイン", description: "話者の別アングル", status: "未撮影" },
  { id: nextId(), sceneName: "フック3", materialName: "インタビュー素材C", materialType: "メイン", description: "話者のリアクション", status: "撮影済" },
  { id: nextId(), sceneName: "商品紹介", materialName: "PC操作画面", materialType: "メイン", description: "AIツール使用シーン", status: "未撮影" },
  { id: nextId(), sceneName: "商品紹介", materialName: "スマホ画面録画", materialType: "サブ", description: "SNS投稿の実績画面", status: "未撮影" },
  { id: nextId(), sceneName: "ベネフィット", materialName: "成果画面スクショ", materialType: "サブ", description: "売上・フォロワー数の画面", status: "編集済" },
  { id: nextId(), sceneName: "CTA", materialName: "ロゴ素材", materialType: "サブ", description: "DOT-AI BOOTCAMPロゴ", status: "編集済" },
];

const INITIAL_CALLSHEET: CallSheetRow[] = [
  { id: nextId(), sceneNo: "01", materialName: "インタビュー素材A", shootContent: "話者正面インタビュー（フック用）", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", props: "マイク", shootTime: "10:00-10:30", note: "自然光を活用" },
  { id: nextId(), sceneNo: "02", materialName: "インタビュー素材B", shootContent: "話者別アングルインタビュー", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", props: "マイク", shootTime: "10:30-11:00", note: "" },
  { id: nextId(), sceneNo: "03", materialName: "インタビュー素材C", shootContent: "リアクション・うなずきカット", location: "スタジオA", cast: "出演者A", costume: "カジュアル（白Tシャツ）", props: "", shootTime: "11:00-11:15", note: "寄りカット多め" },
  { id: nextId(), sceneNo: "04", materialName: "PC操作画面", shootContent: "AIツール操作デモ", location: "デスク", cast: "出演者A", costume: "同上", props: "PC・モニター", shootTime: "11:30-12:00", note: "画面録画も同時に" },
  { id: nextId(), sceneNo: "05", materialName: "スマホ画面録画", shootContent: "SNS投稿実績の画面録画", location: "デスク", cast: "", costume: "", props: "スマホ", shootTime: "12:00-12:15", note: "縦画面で録画" },
];

// ─── Main Page ────────────────────────────────────────
export default function ShootingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [activeTab, setActiveTab] = useState<"materials" | "callsheet">("materials");
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const [callsheet, setCallsheet] = useState<CallSheetRow[]>(INITIAL_CALLSHEET);

  // Material handlers
  const updateMaterial = useCallback((id: number, field: string, value: any) => {
    setMaterials((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  }, []);

  const addMaterial = useCallback(() => {
    setMaterials((prev) => [...prev, {
      id: nextId(), sceneName: "", materialName: "", materialType: "メイン", description: "", status: "未撮影",
    }]);
  }, []);

  const removeMaterial = useCallback((id: number) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Callsheet handlers
  const updateCallsheet = useCallback((id: number, field: string, value: string) => {
    setCallsheet((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const addCallsheetRow = useCallback(() => {
    setCallsheet((prev) => [...prev, {
      id: nextId(), sceneNo: String(prev.length + 1).padStart(2, "0"), materialName: "", shootContent: "", location: "", cast: "", costume: "", props: "", shootTime: "", note: "",
    }]);
  }, []);

  const removeCallsheetRow = useCallback((id: number) => {
    setCallsheet((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const materialStats = {
    total: materials.length,
    unshot: materials.filter((m) => m.status === "未撮影").length,
    shot: materials.filter((m) => m.status === "撮影済").length,
    edited: materials.filter((m) => m.status === "編集済").length,
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 py-3 flex items-center gap-3">
          <Link href={`/projects/${projectId}/materials`}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#1A1A2E]/30 font-medium mb-0.5">撮影準備</p>
            <h1 className="text-lg font-bold text-[#1A1A2E]">撮影管理</h1>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#1A1A2E]/30">素材 {materialStats.total}件</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">未撮影 {materialStats.unshot}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">撮影済 {materialStats.shot}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">編集済 {materialStats.edited}</span>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.03] text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] transition-all">
            <Download className="w-3.5 h-3.5" /> 香盤票ダウンロード
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-0 border-t border-black/[0.03]">
          {[
            { key: "materials" as const, label: "必要素材リスト", icon: ListChecks },
            { key: "callsheet" as const, label: "香盤票", icon: Camera },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${
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
        {activeTab === "materials" && (
          <div className="max-w-5xl mx-auto">
            <p className="text-[10px] text-[#1A1A2E]/30 mb-3">編集概要から自動抽出された素材 + 手動追加分</p>
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[40px_100px_1fr_80px_1fr_100px_40px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/40 uppercase tracking-wider">
                <div className="px-2 py-2.5"></div>
                <div className="px-2 py-2.5">シーン</div>
                <div className="px-2 py-2.5">素材名</div>
                <div className="px-2 py-2.5">種別</div>
                <div className="px-2 py-2.5">説明</div>
                <div className="px-2 py-2.5">ステータス</div>
                <div className="px-2 py-2.5"></div>
              </div>

              {materials.map((item) => {
                const ss = STATUS_STYLES[item.status];
                return (
                  <div key={item.id} className="grid grid-cols-[40px_100px_1fr_80px_1fr_100px_40px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors group">
                    <div className="px-2 py-2 flex items-center justify-center">
                      {item.status === "編集済" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : item.status === "撮影済" ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#1A1A2E]/15" />
                      )}
                    </div>
                    <div className="px-2 py-2">
                      <input value={item.sceneName} onChange={(e) => updateMaterial(item.id, "sceneName", e.target.value)}
                        className="w-full text-[11px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none" />
                    </div>
                    <div className="px-2 py-2">
                      <input value={item.materialName} onChange={(e) => updateMaterial(item.id, "materialName", e.target.value)}
                        placeholder="素材名" className="w-full text-[11px] text-[#1A1A2E]/80 font-medium bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/20" />
                    </div>
                    <div className="px-2 py-2">
                      <select value={item.materialType} onChange={(e) => updateMaterial(item.id, "materialType", e.target.value)}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer outline-none ${
                          item.materialType === "メイン" ? "bg-purple-50 text-purple-600" : "bg-cyan-50 text-cyan-600"
                        }`}>
                        <option value="メイン">メイン</option>
                        <option value="サブ">サブ</option>
                      </select>
                    </div>
                    <div className="px-2 py-2">
                      <input value={item.description} onChange={(e) => updateMaterial(item.id, "description", e.target.value)}
                        placeholder="撮影内容の説明" className="w-full text-[11px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/15" />
                    </div>
                    <div className="px-2 py-2">
                      <select value={item.status} onChange={(e) => updateMaterial(item.id, "status", e.target.value)}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-pointer outline-none ${ss.bg} ${ss.text}`}>
                        <option value="未撮影">未撮影</option>
                        <option value="撮影済">撮影済</option>
                        <option value="編集済">編集済</option>
                      </select>
                    </div>
                    <div className="px-2 py-2 flex items-center">
                      <button onClick={() => removeMaterial(item.id)}
                        className="text-[#1A1A2E]/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button onClick={addMaterial}
                className="w-full py-2.5 text-[10px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] flex items-center justify-center gap-1 transition-all">
                <Plus className="w-3 h-3" /> 素材を追加
              </button>
            </div>
          </div>
        )}

        {activeTab === "callsheet" && (
          <div className="max-w-full mx-auto overflow-x-auto">
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden" style={{ minWidth: 1100 }}>
              {/* Header */}
              <div className="grid grid-cols-[50px_120px_1fr_120px_100px_120px_120px_100px_120px_40px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/40 uppercase tracking-wider">
                <div className="px-2 py-2.5">No.</div>
                <div className="px-2 py-2.5">素材名</div>
                <div className="px-2 py-2.5">撮影内容</div>
                <div className="px-2 py-2.5">撮影場所</div>
                <div className="px-2 py-2.5">出演者</div>
                <div className="px-2 py-2.5">衣装</div>
                <div className="px-2 py-2.5">小道具</div>
                <div className="px-2 py-2.5">撮影時間</div>
                <div className="px-2 py-2.5">備考</div>
                <div className="px-2 py-2.5"></div>
              </div>

              {callsheet.map((row) => (
                <div key={row.id} className="grid grid-cols-[50px_120px_1fr_120px_100px_120px_120px_100px_120px_40px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors group">
                  <div className="px-2 py-2 text-[11px] text-[#1A1A2E]/40 font-medium text-center">{row.sceneNo}</div>
                  {(["materialName", "shootContent", "location", "cast", "costume", "props", "shootTime", "note"] as const).map((field) => (
                    <div key={field} className="px-2 py-1.5">
                      <input value={row[field]} onChange={(e) => updateCallsheet(row.id, field, e.target.value)}
                        placeholder={field === "materialName" ? "素材名" : field === "shootContent" ? "撮影内容" : field === "location" ? "場所" : field === "cast" ? "出演者" : field === "costume" ? "衣装" : field === "props" ? "小道具" : field === "shootTime" ? "時間" : "備考"}
                        className="w-full text-[11px] text-[#1A1A2E]/70 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded px-1 py-0.5 outline-none placeholder:text-[#1A1A2E]/15" />
                    </div>
                  ))}
                  <div className="px-2 py-2 flex items-center">
                    <button onClick={() => removeCallsheetRow(row.id)}
                      className="text-[#1A1A2E]/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={addCallsheetRow}
                className="w-full py-2.5 text-[10px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] flex items-center justify-center gap-1 transition-all">
                <Plus className="w-3 h-3" /> 行を追加
              </button>
            </div>
          </div>
        )}
      </div>

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
