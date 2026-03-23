"use client";

import { use, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Plus, Search, FileText, Video, Tag, ChevronRight } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────
type CheckStatus = "確認依頼" | "承認済" | "要修正";
type CheckResult = "ok" | "ng" | "warning";

type Creative = {
  id: string;
  name: string;
  version: string;
  status: CheckStatus;
  submittedAt: string;
  scriptNg: number;
  videoNg: number;
  scriptTotal: number;
  videoTotal: number;
  scriptChecks: SceneCheck[];
  videoChecks: SceneCheck[];
};

type SceneCheck = {
  id: number;
  sceneNum: number;
  section: string;
  text: string;
  result: CheckResult;
  issues: Issue[];
};

type Issue = {
  id: number;
  category: "薬機法" | "景表法" | "クライアント固有" | "素材権利" | "その他";
  severity: "error" | "warning";
  description: string;
  suggestion: string;
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
const STATUS_OPTIONS: { value: CheckStatus; bg: string; text: string }[] = [
  { value: "確認依頼", bg: "bg-amber-50", text: "text-amber-700" },
  { value: "承認済", bg: "bg-emerald-50", text: "text-emerald-700" },
  { value: "要修正", bg: "bg-red-50", text: "text-red-700" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "薬機法": "bg-red-50 text-red-600",
  "景表法": "bg-orange-50 text-orange-600",
  "クライアント固有": "bg-blue-50 text-blue-600",
  "素材権利": "bg-purple-50 text-purple-600",
  "その他": "bg-gray-100 text-gray-600",
};

const SECTION_COLORS: Record<string, { badgeBg: string; text: string }> = {
  "フック1": { badgeBg: "bg-rose-50", text: "text-rose-600" },
  "フック2": { badgeBg: "bg-rose-50", text: "text-rose-500" },
  "フック3": { badgeBg: "bg-purple-50", text: "text-purple-600" },
  "商品紹介": { badgeBg: "bg-amber-50", text: "text-amber-700" },
  "権威性": { badgeBg: "bg-indigo-50", text: "text-indigo-600" },
  "ベネフィット": { badgeBg: "bg-purple-50", text: "text-purple-600" },
  "CTA": { badgeBg: "bg-pink-50", text: "text-pink-600" },
};

// ─── Sample Data ──────────────────────────────────────
const CREATIVES: Creative[] = [
  {
    id: "cr-001", name: "フリーランス2.0体験談", version: "初稿", status: "要修正", submittedAt: "2026-03-20",
    scriptNg: 5, videoNg: 3, scriptTotal: 10, videoTotal: 5,
    scriptChecks: [
      { id: 1, sceneNum: 1, section: "フック1", text: "未経験なら AIフリーランス めちゃチャンスです🥺", result: "ng", issues: [
        { id: 1, category: "景表法", severity: "warning", description: "「めちゃチャンス」は誇大表現の可能性", suggestion: "「チャンスが広がっています」に変更" },
      ]},
      { id: 2, sceneNum: 2, section: "フック2", text: "AIのおかげで 収入変わりすぎて 正直びっくり🤩", result: "ng", issues: [
        { id: 2, category: "景表法", severity: "error", description: "「収入変わりすぎて」は効果を断定する表現", suggestion: "「収入に変化があり」に変更" },
        { id: 3, category: "薬機法", severity: "warning", description: "個人の体験談として注釈が必要", suggestion: "「※個人の感想です」注釈を追加" },
      ]},
      { id: 3, sceneNum: 3, section: "フック3", text: "給料・職場環境 変わらない 会社員辞めて", result: "ok", issues: [] },
      { id: 4, sceneNum: 5, section: "フック3", text: "バブルすぎて びっくりしてます😭", result: "ng", issues: [
        { id: 4, category: "景表法", severity: "error", description: "「バブルすぎて」は収益を誇大に表現", suggestion: "「想像以上の成果が出て」に変更" },
      ]},
      { id: 5, sceneNum: 6, section: "商品紹介", text: "会社員時代の月収を上回る", result: "ng", issues: [
        { id: 5, category: "景表法", severity: "error", description: "「月収を上回る」は具体的な収益を示唆", suggestion: "「新たな収入源を確保」に変更" },
      ]},
      { id: 6, sceneNum: 7, section: "商品紹介", text: "初めは AI使わなきゃな〜って", result: "ok", issues: [] },
      { id: 7, sceneNum: 9, section: "権威性", text: "マーケで成功してる 連続起業家 発案だから", result: "warning", issues: [
        { id: 6, category: "クライアント固有", severity: "warning", description: "「成功してる」の根拠が不明確", suggestion: "具体的な実績を記載するか表現を緩和" },
      ]},
      { id: 8, sceneNum: 10, section: "CTA", text: "3ヶ月で 会社員時代の 収入額更新✨", result: "ng", issues: [
        { id: 7, category: "景表法", severity: "error", description: "「3ヶ月で収入額更新」は期間と効果を断定", suggestion: "「※個人の体験であり効果を保証するものではありません」を追加" },
      ]},
      { id: 9, sceneNum: 8, section: "商品紹介", text: "チャッピー愛用してたけど", result: "ok", issues: [] },
      { id: 10, sceneNum: 4, section: "フック3", text: "AIフリーランスに転身したら・・・", result: "ok", issues: [] },
    ],
    videoChecks: [
      { id: 101, sceneNum: 1, section: "フック1", text: "テロップ: 未経験ならAIフリーランス", result: "ok", issues: [] },
      { id: 102, sceneNum: 2, section: "フック2", text: "テロップ: 収入変わりすぎて", result: "ng", issues: [
        { id: 101, category: "景表法", severity: "error", description: "テロップに誇大表現が残っている", suggestion: "台本修正後のテキストに合わせて更新" },
      ]},
      { id: 103, sceneNum: 5, section: "フック3", text: "テロップ: バブルすぎてびっくり", result: "ng", issues: [
        { id: 102, category: "景表法", severity: "error", description: "テロップ表現が未修正", suggestion: "修正済みテキストを反映" },
      ]},
      { id: 104, sceneNum: 10, section: "CTA", text: "注釈サイズ・表示時間", result: "ng", issues: [
        { id: 103, category: "クライアント固有", severity: "warning", description: "注釈の表示時間が短い（1秒未満）", suggestion: "注釈を3秒以上表示するよう調整" },
      ]},
      { id: 105, sceneNum: 6, section: "商品紹介", text: "素材: メイン動画", result: "ok", issues: [] },
    ],
  },
  {
    id: "cr-002", name: "フリーランス2.0体験談", version: "修正1回目", status: "確認依頼", submittedAt: "2026-03-22",
    scriptNg: 1, videoNg: 1, scriptTotal: 10, videoTotal: 5,
    scriptChecks: [], videoChecks: [],
  },
  {
    id: "cr-003", name: "AI副業スタート", version: "初稿", status: "承認済", submittedAt: "2026-03-18",
    scriptNg: 0, videoNg: 0, scriptTotal: 8, videoTotal: 4,
    scriptChecks: [], videoChecks: [],
  },
];

const KNOWLEDGE: KnowledgeItem[] = [
  { id: 1, tags: ["NG表現", "景表法"], ngExpression: "〇〇するだけで月収△△万円", correction: "収入を保証する表現は使用不可。「収入に変化があった」等に変更", source: "景表法", createdAt: "2026-03-01" },
  { id: 2, tags: ["NG表現", "薬機法"], ngExpression: "効果を実感", correction: "「変化を感じた」に変更。個人の感想である旨の注釈必須", source: "薬機法", createdAt: "2026-03-05" },
  { id: 3, tags: ["言い換え", "クライアント指摘"], ngExpression: "絶対に稼げる", correction: "断定表現NG。「可能性がある」「チャンスが広がる」に変更", source: "クライアント指摘", createdAt: "2026-03-10" },
  { id: 4, tags: ["注釈", "景表法"], ngExpression: "体験談で注釈なし", correction: "「※個人の感想であり効果を保証するものではありません」を常時表示", source: "景表法", createdAt: "2026-02-20" },
  { id: 5, tags: ["素材権利"], ngExpression: "他社ロゴの無断使用", correction: "使用許諾を取得するか、モザイク処理", source: "クライアント指摘", createdAt: "2026-03-15" },
];

// ─── Main Page ────────────────────────────────────────
export default function RegulationsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null);
  const [checkTab, setCheckTab] = useState<"script" | "video">("script");
  const [topTab, setTopTab] = useState<"list" | "knowledge">("list");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeTagFilter, setKnowledgeTagFilter] = useState("");

  const creative = CREATIVES.find((c) => c.id === selectedCreative);
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
          {selectedCreative ? (
            <button onClick={() => setSelectedCreative(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link href={`/projects/${projectId}/editing`}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#1A1A2E]/30 font-medium mb-0.5">レギュレーション</p>
            {creative ? (
              <h1 className="text-lg font-bold text-[#1A1A2E]">{creative.name} <span className="text-[13px] text-[#1A1A2E]/40 font-medium">({creative.version})</span></h1>
            ) : (
              <h1 className="text-lg font-bold text-[#1A1A2E]">提出リスト</h1>
            )}
          </div>
          {creative && (() => {
            const s = STATUS_OPTIONS.find((o) => o.value === creative.status) || STATUS_OPTIONS[0];
            return <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${s.bg} ${s.text}`}>{creative.status}</span>;
          })()}
        </div>

        {/* Tabs */}
        {!selectedCreative ? (
          <div className="px-6 flex gap-0 border-t border-black/[0.03]">
            <button onClick={() => setTopTab("list")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${topTab === "list" ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <FileText className="w-3.5 h-3.5" /> 提出リスト
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${topTab === "list" ? "bg-[#9333EA]/10 text-[#9333EA]" : "bg-black/[0.04] text-[#1A1A2E]/30"}`}>{CREATIVES.length}</span>
            </button>
            <button onClick={() => setTopTab("knowledge")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${topTab === "knowledge" ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <Tag className="w-3.5 h-3.5" /> ナレッジ
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${topTab === "knowledge" ? "bg-[#9333EA]/10 text-[#9333EA]" : "bg-black/[0.04] text-[#1A1A2E]/30"}`}>{KNOWLEDGE.length}</span>
            </button>
          </div>
        ) : (
          <div className="px-6 flex gap-0 border-t border-black/[0.03]">
            <button onClick={() => setCheckTab("script")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${checkTab === "script" ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <FileText className="w-3.5 h-3.5" /> 台本チェック
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${checkTab === "script" ? "bg-[#9333EA]/10 text-[#9333EA]" : "bg-black/[0.04] text-[#1A1A2E]/30"}`}>{creative?.scriptTotal}</span>
            </button>
            <button onClick={() => setCheckTab("video")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${checkTab === "video" ? "border-[#9333EA] text-[#9333EA]" : "border-transparent text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
              <Video className="w-3.5 h-3.5" /> 動画チェック
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${checkTab === "video" ? "bg-[#9333EA]/10 text-[#9333EA]" : "bg-black/[0.04] text-[#1A1A2E]/30"}`}>{creative?.videoTotal}</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedCreative && topTab === "list" && (
          /* ── Creative submission list ── */
          <div className="max-w-4xl mx-auto space-y-2">
            {CREATIVES.map((cr) => {
              const s = STATUS_OPTIONS.find((o) => o.value === cr.status) || STATUS_OPTIONS[0];
              const totalNg = cr.scriptNg + cr.videoNg;
              return (
                <button key={cr.id} onClick={() => { setSelectedCreative(cr.id); setCheckTab("script"); }}
                  className="w-full bg-white rounded-xl border border-black/[0.06] hover:border-[#9333EA]/20 hover:shadow-sm px-5 py-4 flex items-center gap-4 transition-all text-left group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-bold text-[#1A1A2E]">{cr.name}</span>
                      <span className="text-[11px] text-[#1A1A2E]/30 font-medium">{cr.version}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#1A1A2E]/40">
                      <span>提出日: {cr.submittedAt}</span>
                      <span>台本 {cr.scriptTotal}シーン</span>
                      <span>動画 {cr.videoTotal}シーン</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {totalNg > 0 ? (
                      <div className="flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-[12px] font-semibold text-red-600">{totalNg}件NG</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-[12px] font-semibold text-emerald-600">全件OK</span>
                      </div>
                    )}
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{cr.status}</span>
                    <ChevronRight className="w-4 h-4 text-[#1A1A2E]/15 group-hover:text-[#9333EA]/50 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!selectedCreative && topTab === "knowledge" && (
          /* ── Knowledge tab ── */
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-white rounded-xl border border-black/[0.06] px-3 py-2">
                <Search className="w-4 h-4 text-[#1A1A2E]/25" />
                <input value={knowledgeSearch} onChange={(e) => setKnowledgeSearch(e.target.value)}
                  placeholder="ナレッジを検索..." className="flex-1 text-[12px] text-[#1A1A2E]/70 bg-transparent outline-none placeholder:text-[#1A1A2E]/20" />
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

        {selectedCreative && creative && (() => {
          const checks = checkTab === "script" ? creative.scriptChecks : creative.videoChecks;
          const okCount = checks.filter((c) => c.result === "ok").length;
          const ngCount = checks.filter((c) => c.result === "ng").length;
          const warnCount = checks.filter((c) => c.result === "warning").length;

          if (checks.length === 0) {
            return (
              <div className="max-w-4xl mx-auto text-center py-12">
                <p className="text-[14px] text-[#1A1A2E]/30">チェック結果はまだありません</p>
                <p className="text-[11px] text-[#1A1A2E]/20 mt-1">提出後にAIが自動チェックします</p>
              </div>
            );
          }

          return (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 bg-white rounded-xl border border-black/[0.06] px-5 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-[13px] font-semibold text-emerald-600">{okCount} OK</span>
                </div>
                <div className="h-4 w-[1px] bg-black/[0.06]" />
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-[13px] font-semibold text-red-600">{ngCount} NG</span>
                </div>
                <div className="h-4 w-[1px] bg-black/[0.06]" />
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-[13px] font-semibold text-amber-600">{warnCount} 警告</span>
                </div>
                <div className="flex-1" />
                <span className="text-[11px] text-[#1A1A2E]/30">{checks.length}シーン中 {okCount}件通過</span>
              </div>

              {/* Scene check list */}
              <div className="space-y-2">
                {checks.map((check) => {
                  const sc = SECTION_COLORS[check.section] || { badgeBg: "bg-gray-100", text: "text-gray-500" };
                  return (
                    <div key={check.id} className={`bg-white rounded-xl border overflow-hidden ${
                      check.result === "ng" ? "border-red-200" : check.result === "ok" ? "border-emerald-100" : "border-amber-200"
                    }`}>
                      <div className={`flex items-center gap-3 px-4 py-2.5 ${
                        check.result === "ng" ? "bg-red-50/50" : check.result === "ok" ? "bg-emerald-50/30" : "bg-amber-50/30"
                      }`}>
                        <span className="text-[11px] font-bold text-[#1A1A2E]/30">{String(check.sceneNum).padStart(2, "0")}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${sc.badgeBg} ${sc.text}`}>{check.section}</span>
                        <p className="text-[12px] text-[#1A1A2E]/60 flex-1 truncate">{check.text.replace(/\n/g, " ")}</p>
                        {check.result === "ok" ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                        ) : check.result === "ng" ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600"><XCircle className="w-3.5 h-3.5" /> NG</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> 要確認</span>
                        )}
                      </div>
                      {check.issues.length > 0 && (
                        <div className="border-t border-black/[0.04] px-4 py-2 space-y-2">
                          {check.issues.map((issue) => (
                            <div key={issue.id} className="flex gap-3">
                              <div className="shrink-0 mt-0.5">
                                {issue.severity === "error" ? <XCircle className="w-3.5 h-3.5 text-red-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[issue.category]}`}>{issue.category}</span>
                                <p className="text-[11px] text-[#1A1A2E]/70 leading-relaxed mt-0.5">{issue.description}</p>
                                <p className="text-[11px] text-[#9333EA]/70 mt-0.5">💡 {issue.suggestion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
