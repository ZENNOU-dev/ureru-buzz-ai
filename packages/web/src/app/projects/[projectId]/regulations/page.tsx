"use client";

import { use, type SetStateAction } from "react";
import { usePageUndoDraft } from "@/hooks/use-page-undo-draft";
import { ArrowLeft, Plus, Search, FileText, Video, Tag, ExternalLink, LayoutList, LayoutGrid, X } from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type RegItem = {
  no: number;
  date: string;
  person: string;
  type: string;
  appeal: string;
  plan: string;
  url: string;
  note: string;
  checkDate: string;
  result: "OK" | "NG" | "修正依頼" | "";
};

type KnowledgeItem = {
  id: number;
  tags: string[];
  ngExpression: string;
  correction: string;
  source: string;
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────
const RESULT_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  "OK": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "NG": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  "修正依頼": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  "": { bg: "bg-gray-50", text: "text-gray-400", dot: "bg-gray-300" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "薬機法": "bg-red-50 text-red-600",
  "景表法": "bg-orange-50 text-orange-600",
  "クライアント指摘": "bg-blue-50 text-blue-600",
  "素材権利": "bg-purple-50 text-purple-600",
};

// ─── Sample Data ──────────────────────────────────────
const REG_ITEMS: RegItem[] = [
  { no: 1, date: "2025/12/15", person: "横野", type: "記事/LP台本", appeal: "AI活用型訴求", plan: "成功談記事", url: "【制作管理】DOT-AI×BONNOU", note: "", checkDate: "", result: "OK" },
  { no: 2, date: "2025/12/15", person: "横野", type: "CR台本", appeal: "AI活用型訴求", plan: "AI副業", url: "【制作管理】DOT-AI×BONNOU", note: "", checkDate: "", result: "OK" },
  { no: 3, date: "2025/12/15", person: "横野", type: "CR台本", appeal: "AI活用型訴求", plan: "三日坊主", url: "【制作管理】DOT-AI×BONNOU", note: "", checkDate: "", result: "OK" },
  { no: 4, date: "2025/12/15", person: "横野", type: "CR台本", appeal: "AI活用型訴求", plan: "特典推し", url: "【制作管理】DOT-AI×BONNOU", note: "", checkDate: "", result: "OK" },
  { no: 5, date: "2025/12/22", person: "渋谷", type: "ショート動画", appeal: "AI活用型訴求", plan: "AI副業", url: "渋谷_AI副業A.mp4", note: "", checkDate: "", result: "OK" },
  { no: 6, date: "2025/12/22", person: "渋谷", type: "ショート動画", appeal: "AI活用型訴求", plan: "", url: "渋谷_AI副業B.mp4", note: "", checkDate: "", result: "OK" },
  { no: 7, date: "2025/12/22", person: "渋谷", type: "ショート動画", appeal: "AI活用型訴求", plan: "", url: "渋谷_AI副業C.mp4", note: "", checkDate: "", result: "OK" },
  { no: 8, date: "2025/12/22", person: "渋谷", type: "ショート動画", appeal: "AI活用型訴求", plan: "三日坊主", url: "渋谷_特典推しA.mp4", note: "", checkDate: "", result: "OK" },
  { no: 9, date: "2025/12/22", person: "渋谷", type: "ショート動画", appeal: "AI活用型訴求", plan: "", url: "渋谷_特典推しB.mp4", note: "", checkDate: "", result: "OK" },
  { no: 10, date: "2025/12/22", person: "渋谷", type: "ショート動画", appeal: "AI活用型訴求", plan: "", url: "渋谷_特典推しC.mp4", note: "", checkDate: "", result: "OK" },
  { no: 11, date: "2026/02/17", person: "松永", type: "ショート動画", appeal: "AI活用型訴求", plan: "AI副業BU1", url: "松永_AI副業BU1A.mp4", note: "", checkDate: "", result: "OK" },
  { no: 12, date: "2026/02/19", person: "横野", type: "ショート動画", appeal: "AI活用型訴求", plan: "フリーランス2.0", url: "【制作管理】DOT-AI×BONNOU", note: "", checkDate: "", result: "OK" },
  { no: 13, date: "2026/02/19", person: "横野", type: "ショート動画", appeal: "AI活用型訴求", plan: "女性2.0", url: "【制作管理】DOT-AI×BONNOU", note: "", checkDate: "", result: "OK" },
  { no: 14, date: "2026/02/26", person: "横野", type: "ショート動画", appeal: "AIフリーランス訴求", plan: "女性2.0", url: "横野_女性2.0_A.mp4", note: "", checkDate: "", result: "OK" },
  { no: 15, date: "2026/03/20", person: "横野", type: "CR台本", appeal: "AIフリーランス訴求", plan: "フリーランス2.0体験談", url: "", note: "初稿", checkDate: "2026/03/21", result: "修正依頼" },
  { no: 16, date: "2026/03/22", person: "横野", type: "ショート動画", appeal: "AIフリーランス訴求", plan: "フリーランス2.0体験談", url: "", note: "初稿動画", checkDate: "", result: "" },
];

const KNOWLEDGE: KnowledgeItem[] = [
  { id: 1, tags: ["NG表現", "景表法"], ngExpression: "〇〇するだけで月収△△万円", correction: "収入を保証する表現は使用不可。「収入に変化があった」等に変更", source: "景表法", createdAt: "2026-03-01" },
  { id: 2, tags: ["NG表現", "薬機法"], ngExpression: "効果を実感", correction: "「変化を感じた」に変更。個人の感想である旨の注釈必須", source: "薬機法", createdAt: "2026-03-05" },
  { id: 3, tags: ["言い換え", "クライアント指摘"], ngExpression: "絶対に稼げる", correction: "断定表現NG。「可能性がある」「チャンスが広がる」に変更", source: "クライアント指摘", createdAt: "2026-03-10" },
  { id: 4, tags: ["注釈", "景表法"], ngExpression: "体験談で注釈なし", correction: "「※個人の感想であり効果を保証するものではありません」を常時表示", source: "景表法", createdAt: "2026-02-20" },
  { id: 5, tags: ["素材権利"], ngExpression: "他社ロゴの無断使用", correction: "使用許諾を取得するか、モザイク処理", source: "クライアント指摘", createdAt: "2026-03-15" },
];

function isScriptType(type: string) {
  return type.includes("台本") || type.includes("記事");
}

// ─── Main Page ────────────────────────────────────────
type RegulationsDraft = {
  activeTab: "script" | "video" | "knowledge";
  viewMode: "table" | "card";
  knowledgeSearch: string;
  knowledgeTagFilter: string;
  showRegSheet: boolean;
};

export default function RegulationsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [draft, setField] = usePageUndoDraft<RegulationsDraft>(
    () => ({
      activeTab: "script",
      viewMode: "table",
      knowledgeSearch: "",
      knowledgeTagFilter: "",
      showRegSheet: false,
    }),
    { mergeWindowMs: 400 },
  );
  const { activeTab, viewMode, knowledgeSearch, knowledgeTagFilter, showRegSheet } = draft;
  const setActiveTab = (u: SetStateAction<RegulationsDraft["activeTab"]>) => setField("activeTab", u);
  const setViewMode = (u: SetStateAction<RegulationsDraft["viewMode"]>) => setField("viewMode", u);
  const setKnowledgeSearch = (u: SetStateAction<string>) => setField("knowledgeSearch", u);
  const setKnowledgeTagFilter = (u: SetStateAction<string>) => setField("knowledgeTagFilter", u);
  const setShowRegSheet = (u: SetStateAction<boolean>) => setField("showRegSheet", u);

  const scriptItems = REG_ITEMS.filter((r) => isScriptType(r.type));
  const videoItems = REG_ITEMS.filter((r) => !isScriptType(r.type));
  const items = activeTab === "script" ? scriptItems : activeTab === "video" ? videoItems : [];

  const allTags = Array.from(new Set(KNOWLEDGE.flatMap((k) => k.tags)));
  const filteredKnowledge = KNOWLEDGE.filter((k) => {
    if (knowledgeSearch && !k.ngExpression.includes(knowledgeSearch) && !k.correction.includes(knowledgeSearch)) return false;
    if (knowledgeTagFilter && !k.tags.includes(knowledgeTagFilter)) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 py-3 flex items-center gap-3">
          <Link href={`/projects/${projectId}/editing`}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#1A1A2E]/30 font-medium mb-0.5">レギュレーション</p>
            <h1 className="text-lg font-bold text-[#1A1A2E]">レギュ確認リスト</h1>
          </div>
          {/* View toggle (table/card) - only for list tabs */}
          {activeTab !== "knowledge" && (
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
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-0 border-t border-black/[0.03]">
          {[
            { key: "script" as const, label: "台本確認リスト", icon: FileText, count: scriptItems.length },
            { key: "video" as const, label: "広告確認リスト", icon: Video, count: videoItems.length },
            { key: "knowledge" as const, label: "ナレッジ", icon: Tag, count: KNOWLEDGE.length },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${
                activeTab === tab.key ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-[#9333EA]/10 text-[#9333EA]" : "bg-black/[0.04] text-[#1A1A2E]/30"}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {(activeTab === "script" || activeTab === "video") && viewMode === "table" && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_100px] bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/40 uppercase tracking-wider">
                <div className="px-3 py-3">No.</div>
                <div className="px-2 py-3">記載日付</div>
                <div className="px-2 py-3">担当者</div>
                <div className="px-2 py-3">確認物</div>
                <div className="px-2 py-3">訴求名</div>
                <div className="px-2 py-3">企画名</div>
                <div className="px-2 py-3">確認ページ</div>
                <div className="px-2 py-3">備考</div>
                <div className="px-2 py-3">確認日付</div>
                <div className="px-2 py-3">可否</div>
              </div>
              {items.map((item) => {
                const rs = RESULT_STYLES[item.result] || RESULT_STYLES[""];
                const isScript = isScriptType(item.type);
                const confirmLink = isScript ? `/projects/${projectId}/scripts/script-001` : `/projects/${projectId}/editing`;
                const confirmLabel = isScript ? "台本を確認" : "動画を確認";
                return (
                  <div key={item.no} className={`grid grid-cols-[50px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_100px] border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors ${
                    item.result === "NG" || item.result === "修正依頼" ? "bg-red-50/30" : ""
                  }`}>
                    <div className="px-3 py-3.5 text-[12px] text-[#1A1A2E]/40 font-medium">{item.no}</div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/60">{item.date}</div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/70 font-medium">{item.person}</div>
                    <div className="px-2 py-3.5 flex items-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                        item.type.includes("台本") ? "bg-blue-50 text-blue-600" : item.type.includes("動画") ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-600"
                      }`}>{item.type}</span>
                    </div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/60 truncate">{item.appeal}</div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/70 font-medium truncate">{item.plan}</div>
                    <div className="px-2 py-3.5 text-[11px]">
                      <Link href={confirmLink} className="flex items-center gap-1 text-[#9333EA]/70 hover:text-[#9333EA] transition-colors">
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{confirmLabel}</span>
                      </Link>
                    </div>
                    <div className="px-2 py-3.5 text-[11px] text-[#1A1A2E]/40">{item.note}</div>
                    <div className="px-2 py-3.5 text-[12px] text-[#1A1A2E]/50">{item.checkDate}</div>
                    <div className="px-2 py-3.5 flex items-center">
                      {item.result ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${rs.bg} ${rs.text}`}>{item.result}</span>
                      ) : (
                        <span className="text-[10px] text-[#1A1A2E]/20">未確認</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-center gap-3 py-3">
                <button className="text-[11px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] flex items-center gap-1 transition-all px-3 py-1.5 rounded-lg">
                  <Plus className="w-3 h-3" /> 行を追加
                </button>
                <span className="text-[10px] text-[#1A1A2E]/20">台本のレギュレーションチェックから自動追加されます</span>
              </div>
            </div>
          </div>
        )}

        {(activeTab === "script" || activeTab === "video") && viewMode === "card" && (
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {items.map((item) => {
                const rs = RESULT_STYLES[item.result] || RESULT_STYLES[""];
                const isScript = isScriptType(item.type);
                const confirmLink = isScript ? `/projects/${projectId}/scripts/script-001` : `/projects/${projectId}/editing`;
                return (
                  <Link key={item.no} href={confirmLink}
                    className={`bg-white rounded-xl border border-black/[0.06] p-4 hover:shadow-md hover:border-[#9333EA]/20 transition-all group ${
                      item.result === "修正依頼" ? "border-l-4 border-l-amber-400" : item.result === "NG" ? "border-l-4 border-l-red-400" : ""
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                        item.type.includes("台本") ? "bg-blue-50 text-blue-600" : item.type.includes("動画") ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-600"
                      }`}>{item.type}</span>
                      {item.result ? (
                        <span className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${rs.dot}`} />
                          <span className={`text-[10px] font-bold ${rs.text}`}>{item.result}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#1A1A2E]/20">未確認</span>
                      )}
                    </div>
                    <h3 className="text-[13px] font-bold text-[#1A1A2E]/80 mb-1 group-hover:text-[#9333EA] transition-colors">
                      {item.plan || item.appeal}
                    </h3>
                    <p className="text-[11px] text-[#1A1A2E]/40 mb-2">{item.appeal}</p>
                    <div className="flex items-center gap-3 text-[10px] text-[#1A1A2E]/30">
                      <span>{item.person}</span>
                      <span>{item.date}</span>
                      {item.note && <span className="text-amber-600/60">{item.note}</span>}
                    </div>
                  </Link>
                );
              })}
              <button className="bg-white/50 rounded-xl border border-dashed border-[#1A1A2E]/10 p-4 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.02] transition-all flex flex-col items-center justify-center gap-1 text-[#1A1A2E]/20 hover:text-[#9333EA]/50 min-h-[120px]">
                <Plus className="w-5 h-5" />
                <span className="text-[11px] font-medium">追加</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-white rounded-xl border border-black/[0.06] px-3 py-2">
                <Search className="w-4 h-4 text-[#1A1A2E]/25" />
                <input value={knowledgeSearch} onChange={(e) => setKnowledgeSearch(e.target.value)}
                  placeholder="ナレッジを検索..." className="flex-1 text-[12px] text-[#1A1A2E]/70 bg-transparent outline-none placeholder:text-[#1A1A2E]/20" />
              </div>
              <button onClick={() => setShowRegSheet(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-black/[0.06] text-[11px] font-semibold text-[#1A1A2E]/50 hover:text-[#9333EA] hover:border-[#9333EA]/30 transition-all shrink-0">
                <FileText className="w-3.5 h-3.5" />
                レギュレーションシート
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setKnowledgeTagFilter("")}
                className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all ${!knowledgeTagFilter ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"}`}>
                すべて
              </button>
              {allTags.map((tag) => (
                <button key={tag} onClick={() => setKnowledgeTagFilter(tag === knowledgeTagFilter ? "" : tag)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all ${knowledgeTagFilter === tag ? "bg-[#9333EA] text-white" : "bg-white border border-black/[0.06] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/60"}`}>
                  {tag}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredKnowledge.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-black/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#9333EA]/[0.06] text-[#9333EA]">{tag}</span>
                    ))}
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.source] || "bg-gray-100 text-gray-500"}`}>{item.source}</span>
                    <span className="text-[9px] text-[#1A1A2E]/20 ml-auto">{item.createdAt}</span>
                  </div>
                  <p className="text-[12px] text-red-500/80 line-through mb-0.5">{item.ngExpression}</p>
                  <p className="text-[12px] text-[#1A1A2E]/70 leading-relaxed">→ {item.correction}</p>
                </div>
              ))}
            </div>
            <button className="w-full py-3 text-[11px] text-[#1A1A2E]/25 hover:text-[#9333EA]/50 hover:bg-[#9333EA]/[0.02] rounded-xl border border-dashed border-[#1A1A2E]/10 hover:border-[#9333EA]/30 transition-all flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> ナレッジを追加
            </button>
          </div>
        )}
      </div>

      {/* Regulation sheet embedded modal */}
      {showRegSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] shrink-0">
              <h2 className="text-[14px] font-bold text-[#1A1A2E]">レギュレーションシート</h2>
              <div className="flex items-center gap-2">
                <a href="https://docs.google.com/spreadsheets/d/16DAJi3HwtPdsoP05vXTLEBkjCVDeYMIg7tDgEqn1IZE/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#9333EA]/70 hover:text-[#9333EA] transition-colors">
                  <ExternalLink className="w-3 h-3" /> 別タブで開く
                </a>
                <button onClick={() => setShowRegSheet(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] text-[#1A1A2E]/30 hover:text-[#1A1A2E]/60 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <iframe
                src="https://docs.google.com/spreadsheets/d/16DAJi3HwtPdsoP05vXTLEBkjCVDeYMIg7tDgEqn1IZE/edit?gid=1636515411#gid=1636515411"
                className="w-full h-full border-0"
                title="レギュレーションシート"
              />
            </div>
          </div>
        </div>
      )}

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
