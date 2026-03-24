"use client";

import { use, useState } from "react";
import {
  Plus, X, Search, ChevronDown, ChevronUp, Megaphone, Filter,
  Calendar, User, Target, ExternalLink, Lightbulb, Film,
  Eye, Heart, ShieldCheck, Zap, Edit3, FileText,
} from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type AdPlan = {
  id: number;
  appealId: number;
  name: string;
  date: string;
  assignee: string;
  // 前提情報
  adFormat: string;
  adType: string;
  platform: string;
  targetMetric: string;
  targetValue: string;
  articleUrl: string;
  lpUrl: string;
  // コンテンツ
  interestType: string;
  structureType: string;
  fvText: string;
  fvVisual: string;
  composition: string;
  // 企画仮説
  reasonToWatch: string;
  reasonToRelate: string;
  reasonToBelieve: string;
  reasonToAct: string;
};

type Appeal = {
  id: number;
  name: string;
  who: string;
  what: string;
  why: string;
};

// ─── Constants ────────────────────────────────────────
const ASSIGNEES = ["横野", "渋谷", "松永"];
const AD_FORMATS = ["ショート動画", "記事LP", "バナー", "カルーセル"];
const AD_TYPES = ["新規", "リターゲティング", "類似"];
const PLATFORMS = ["Meta", "TikTok", "X", "YouTube", "Google"];
const TARGET_METRICS = ["CPA", "ROAS", "CVR", "CTR"];
const INTEREST_TYPES = ["体験談", "ビフォーアフター", "ランキング", "ニュース", "ハウツー", "ストーリー"];
const STRUCTURE_TYPES = [
  "フック→共感→コンセプト→商品紹介→ベネフィット→CTA",
  "フック→問題提起→解決策→商品紹介→CTA",
  "フック→ビフォーアフター→商品紹介→CTA",
  "フック→ランキング→商品紹介→CTA",
  "フック→ニュース→商品紹介→CTA",
];

// ─── Sample Appeals ───────────────────────────────────
const APPEALS: Appeal[] = [
  {
    id: 1,
    name: "AI活用型訴求",
    who: "20-30代のAI副業に興味がある会社員",
    what: "AIスキルで収入アップできるフリーランス講座",
    why: "未経験からでもAIを使えば最短で稼げるようになる",
  },
  {
    id: 2,
    name: "AIフリーランス訴求",
    who: "フリーランスに転身したい20-30代女性",
    what: "AIを活用した新時代のフリーランスへの転身プログラム",
    why: "AI時代だからこそフリーランスの可能性が広がっている",
  },
];

// ─── Sample Plans ─────────────────────────────────────
const INITIAL_PLANS: AdPlan[] = [
  {
    id: 1,
    appealId: 1,
    name: "AI副業",
    date: "2026-03-01",
    assignee: "横野",
    adFormat: "ショート動画",
    adType: "新規",
    platform: "Meta",
    targetMetric: "CPA",
    targetValue: "3,000円",
    articleUrl: "",
    lpUrl: "",
    interestType: "体験談",
    structureType: "フック→共感→コンセプト→商品紹介→ベネフィット→CTA",
    fvText: "未経験なのにAIフリーランス めちゃチャンスです",
    fvVisual: "女性がPCに向かう→収益画面を見せる",
    composition: "フック(3秒): 衝撃的な数字を見せる\n共感(5秒): 以前は普通の会社員だった\nコンセプト(5秒): AIフリーランスという選択肢\n商品紹介(10秒): DOT-AIの講座内容\nベネフィット(5秒): 受講生の成果\nCTA(2秒): 今すぐ無料相談",
    reasonToWatch: "AI副業に興味があるターゲットの注目を引く",
    reasonToRelate: "会社員からの転身ストーリーに共感",
    reasonToBelieve: "実際の受講生の成果データで説得力",
    reasonToAct: "期間限定の無料相談で今すぐ行動を促す",
  },
  {
    id: 2,
    appealId: 1,
    name: "三日坊主",
    date: "2026-03-05",
    assignee: "渋谷",
    adFormat: "ショート動画",
    adType: "新規",
    platform: "Meta",
    targetMetric: "CPA",
    targetValue: "3,500円",
    articleUrl: "",
    lpUrl: "",
    interestType: "ビフォーアフター",
    structureType: "フック→ビフォーアフター→商品紹介→CTA",
    fvText: "何やっても続かなかった私が...",
    fvVisual: "",
    composition: "",
    reasonToWatch: "",
    reasonToRelate: "",
    reasonToBelieve: "",
    reasonToAct: "",
  },
  {
    id: 3,
    appealId: 1,
    name: "特典推し",
    date: "2026-03-10",
    assignee: "松永",
    adFormat: "ショート動画",
    adType: "新規",
    platform: "TikTok",
    targetMetric: "CTR",
    targetValue: "2.0%",
    articleUrl: "",
    lpUrl: "",
    interestType: "ハウツー",
    structureType: "",
    fvText: "",
    fvVisual: "",
    composition: "",
    reasonToWatch: "",
    reasonToRelate: "",
    reasonToBelieve: "",
    reasonToAct: "",
  },
  {
    id: 4,
    appealId: 2,
    name: "フリーランス2.0体験談",
    date: "2026-02-20",
    assignee: "横野",
    adFormat: "ショート動画",
    adType: "新規",
    platform: "Meta",
    targetMetric: "CPA",
    targetValue: "2,800円",
    articleUrl: "",
    lpUrl: "",
    interestType: "体験談",
    structureType: "フック→共感→コンセプト→商品紹介→ベネフィット→CTA",
    fvText: "AIフリーランスに転身したら・・・",
    fvVisual: "女性がカフェで自由に仕事をしている映像",
    composition: "フック(3秒): AIフリーランスに転身したら\n共感(5秒): 毎朝の満員電車が嫌だった\nコンセプト(5秒): AI×フリーランスという新しい働き方\n商品紹介(10秒): 講座の具体的な内容\nベネフィット(5秒): 時間と場所に縛られない生活\nCTA(2秒): 無料カウンセリング予約",
    reasonToWatch: "フリーランス転身に興味がある層への訴求",
    reasonToRelate: "通勤や職場環境への不満に共感",
    reasonToBelieve: "実際の転身者のリアルな体験談",
    reasonToAct: "無料カウンセリングで行動ハードルを下げる",
  },
  {
    id: 5,
    appealId: 2,
    name: "女性2.0",
    date: "2026-03-01",
    assignee: "渋谷",
    adFormat: "ショート動画",
    adType: "新規",
    platform: "Meta",
    targetMetric: "CPA",
    targetValue: "3,000円",
    articleUrl: "",
    lpUrl: "",
    interestType: "体験談",
    structureType: "",
    fvText: "事務職OLがAIで人生変わった話",
    fvVisual: "",
    composition: "",
    reasonToWatch: "",
    reasonToRelate: "",
    reasonToBelieve: "",
    reasonToAct: "",
  },
  {
    id: 6,
    appealId: 2,
    name: "サービス紹介",
    date: "2026-03-15",
    assignee: "松永",
    adFormat: "ショート動画",
    adType: "新規",
    platform: "YouTube",
    targetMetric: "ROAS",
    targetValue: "300%",
    articleUrl: "",
    lpUrl: "",
    interestType: "ストーリー",
    structureType: "",
    fvText: "",
    fvVisual: "",
    composition: "",
    reasonToWatch: "",
    reasonToRelate: "",
    reasonToBelieve: "",
    reasonToAct: "",
  },
];

let _nextId = 100;
function nextId() {
  return _nextId++;
}

// ─── Dropdown Component ───────────────────────────────
function Dropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40"
    >
      <option value="">{placeholder || "選択..."}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Editable Field ───────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "textarea";
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows || 3}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 resize-none leading-relaxed"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40"
        />
      )}
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────
function PlanCard({
  plan,
  appeal,
  onUpdate,
}: {
  plan: AdPlan;
  appeal: Appeal | undefined;
  onUpdate: (updated: AdPlan) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function set<K extends keyof AdPlan>(key: K, value: AdPlan[K]) {
    onUpdate({ ...plan, [key]: value });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden hover:shadow-md transition-all">
      {/* ── Header Row ── */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        {/* WHO/WHAT/WHY sidebar */}
        {appeal && (
          <div className="hidden lg:block w-40 shrink-0 border-l-2 border-[#9333EA]/30 pl-3 py-1">
            <p className="text-[10px] font-bold text-[#9333EA]/60 mb-1.5">
              訴求情報
            </p>
            <div className="space-y-1.5">
              <div>
                <span className="text-[9px] font-semibold text-[#9333EA]/40">
                  WHO
                </span>
                <p className="text-[10px] text-[#1A1A2E]/50 leading-tight">
                  {appeal.who}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-[#9333EA]/40">
                  WHAT
                </span>
                <p className="text-[10px] text-[#1A1A2E]/50 leading-tight">
                  {appeal.what}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-[#9333EA]/40">
                  WHY
                </span>
                <p className="text-[10px] text-[#1A1A2E]/50 leading-tight">
                  {appeal.why}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main header content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <input
              type="text"
              value={plan.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="企画名を入力..."
              className="text-base font-bold text-[#1A1A2E] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#9333EA] focus:outline-none transition-colors flex-1 min-w-0 py-0.5"
            />
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-[#1A1A2E]/40 hover:text-[#9333EA] transition-colors shrink-0"
            >
              {expanded ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[#1A1A2E]/50">
              <Calendar size={12} />
              <input
                type="date"
                value={plan.date}
                onChange={(e) => set("date", e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-[#1A1A2E]/60 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#1A1A2E]/50">
              <User size={12} />
              <select
                value={plan.assignee}
                onChange={(e) => set("assignee", e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-[#1A1A2E]/60 cursor-pointer"
              >
                <option value="">担当者</option>
                {ASSIGNEES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            {plan.adFormat && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-[#9333EA]">
                {plan.adFormat}
              </span>
            )}
            {plan.platform && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                {plan.platform}
              </span>
            )}
            {plan.interestType && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                {plan.interestType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded Content ── */}
      {expanded && (
        <div className="px-5 pb-5">
          {/* 前提情報 */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h4 className="text-xs font-bold text-[#1A1A2E]/60 mb-3 flex items-center gap-1.5">
              <Target size={13} className="text-[#9333EA]" />
              前提情報
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
                  広告形式
                </label>
                <Dropdown
                  value={plan.adFormat}
                  options={AD_FORMATS}
                  onChange={(v) => set("adFormat", v)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
                  広告種別
                </label>
                <Dropdown
                  value={plan.adType}
                  options={AD_TYPES}
                  onChange={(v) => set("adType", v)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
                  配信媒体
                </label>
                <Dropdown
                  value={plan.platform}
                  options={PLATFORMS}
                  onChange={(v) => set("platform", v)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
                  目標指標
                </label>
                <Dropdown
                  value={plan.targetMetric}
                  options={TARGET_METRICS}
                  onChange={(v) => set("targetMetric", v)}
                />
              </div>
              <Field
                label="目標数値"
                value={plan.targetValue}
                onChange={(v) => set("targetValue", v)}
                placeholder="例: 3,000円"
              />
              <Field
                label="遷移先記事URL"
                value={plan.articleUrl}
                onChange={(v) => set("articleUrl", v)}
                placeholder="https://..."
              />
              <div className="sm:col-span-2">
                <Field
                  label="遷移先LPURL"
                  value={plan.lpUrl}
                  onChange={(v) => set("lpUrl", v)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* コンテンツ（広告企画） */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h4 className="text-xs font-bold text-[#1A1A2E]/60 mb-3 flex items-center gap-1.5">
              <Film size={13} className="text-[#9333EA]" />
              コンテンツ（広告企画）
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
                  興味の型
                </label>
                <Dropdown
                  value={plan.interestType}
                  options={INTEREST_TYPES}
                  onChange={(v) => set("interestType", v)}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#1A1A2E]/50 mb-1 block">
                  構成の型（動画のみ）
                </label>
                <Dropdown
                  value={plan.structureType}
                  options={STRUCTURE_TYPES}
                  onChange={(v) => set("structureType", v)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field
                label="FV（テキスト）"
                value={plan.fvText}
                onChange={(v) => set("fvText", v)}
                type="textarea"
                rows={2}
                placeholder="ファーストビューのテキストを入力..."
              />
              <Field
                label="FV（映像）"
                value={plan.fvVisual}
                onChange={(v) => set("fvVisual", v)}
                type="textarea"
                rows={2}
                placeholder="ファーストビューの映像イメージを入力..."
              />
            </div>
            <Field
              label="構成"
              value={plan.composition}
              onChange={(v) => set("composition", v)}
              type="textarea"
              rows={5}
              placeholder="動画全体の構成を記述..."
            />
          </div>

          {/* 企画仮説 */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-bold text-[#1A1A2E]/60 mb-3 flex items-center gap-1.5">
              <Lightbulb size={13} className="text-amber-500" />
              企画仮説
            </h4>
            <div className="bg-amber-50/50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-amber-700/60 mb-1 flex items-center gap-1 block">
                    <Eye size={11} />
                    見る理由
                  </label>
                  <textarea
                    value={plan.reasonToWatch}
                    onChange={(e) => set("reasonToWatch", e.target.value)}
                    rows={2}
                    placeholder="なぜユーザーはこの動画を見るのか..."
                    className="w-full px-2.5 py-1.5 text-sm border border-amber-200/60 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400/40 resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-amber-700/60 mb-1 flex items-center gap-1 block">
                    <Heart size={11} />
                    自分ごと化する理由
                  </label>
                  <textarea
                    value={plan.reasonToRelate}
                    onChange={(e) => set("reasonToRelate", e.target.value)}
                    rows={2}
                    placeholder="なぜ自分に関係あると思うのか..."
                    className="w-full px-2.5 py-1.5 text-sm border border-amber-200/60 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400/40 resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-amber-700/60 mb-1 flex items-center gap-1 block">
                    <ShieldCheck size={11} />
                    信じる理由
                  </label>
                  <textarea
                    value={plan.reasonToBelieve}
                    onChange={(e) => set("reasonToBelieve", e.target.value)}
                    rows={2}
                    placeholder="なぜこの内容を信じるのか..."
                    className="w-full px-2.5 py-1.5 text-sm border border-amber-200/60 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400/40 resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-amber-700/60 mb-1 flex items-center gap-1 block">
                    <Zap size={11} />
                    今すぐ行動する理由
                  </label>
                  <textarea
                    value={plan.reasonToAct}
                    onChange={(e) => set("reasonToAct", e.target.value)}
                    rows={2}
                    placeholder="なぜ今すぐ行動するのか..."
                    className="w-full px-2.5 py-1.5 text-sm border border-amber-200/60 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400/40 resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function PlanningPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [plans, setPlans] = useState<AdPlan[]>(INITIAL_PLANS);
  const [appealFilter, setAppealFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const appealNames = APPEALS.map((a) => a.name);

  const filtered = plans.filter((p) => {
    if (appealFilter !== "all") {
      const appeal = APPEALS.find((a) => a.id === p.appealId);
      if (!appeal || appeal.name !== appealFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.fvText.toLowerCase().includes(q) &&
        !p.interestType.toLowerCase().includes(q) &&
        !p.platform.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // Group by appeal
  const grouped = APPEALS.reduce<
    { appeal: Appeal; plans: AdPlan[] }[]
  >((acc, appeal) => {
    const group = filtered.filter((p) => p.appealId === appeal.id);
    if (group.length > 0 || appealFilter === "all" || appealFilter === appeal.name) {
      acc.push({ appeal, plans: group });
    }
    return acc;
  }, []);

  function handleUpdatePlan(updated: AdPlan) {
    setPlans(plans.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleAddPlan(appealId: number) {
    const newPlan: AdPlan = {
      id: nextId(),
      appealId,
      name: "",
      date: new Date().toISOString().slice(0, 10),
      assignee: "",
      adFormat: "",
      adType: "",
      platform: "",
      targetMetric: "",
      targetValue: "",
      articleUrl: "",
      lpUrl: "",
      interestType: "",
      structureType: "",
      fvText: "",
      fvVisual: "",
      composition: "",
      reasonToWatch: "",
      reasonToRelate: "",
      reasonToBelieve: "",
      reasonToAct: "",
    };
    setPlans([...plans, newPlan]);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FAF8F5]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200/60 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="企画名・FV・媒体で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 w-56"
              />
            </div>
          </div>
        </div>

        {/* 訴求フィルタ */}
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-[#1A1A2E]/40" />
          <div className="flex gap-1">
            <button
              onClick={() => setAppealFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                appealFilter === "all"
                  ? "bg-[#9333EA] text-white"
                  : "bg-gray-100 text-[#1A1A2E]/60 hover:bg-gray-200"
              }`}
            >
              すべて
            </button>
            {appealNames.map((name) => (
              <button
                key={name}
                onClick={() => setAppealFilter(name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  appealFilter === name
                    ? "bg-[#9333EA] text-white"
                    : "bg-gray-100 text-[#1A1A2E]/60 hover:bg-gray-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-8">
          {grouped.map(({ appeal, plans: groupPlans }) => (
            <div key={appeal.id}>
              {/* 訴求 section header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Megaphone size={15} className="text-[#9333EA]" />
                  <h2 className="text-sm font-bold text-[#1A1A2E]/70">
                    {appeal.name}
                  </h2>
                  <span className="text-xs text-[#1A1A2E]/40 bg-gray-100 px-2 py-0.5 rounded-full">
                    {groupPlans.length}件
                  </span>
                </div>
                <button
                  onClick={() => handleAddPlan(appeal.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#9333EA]/30 text-[#9333EA] rounded-lg text-xs font-medium hover:bg-[#9333EA]/5 transition-colors"
                >
                  <Plus size={13} />
                  企画を追加
                </button>
              </div>

              {/* Cards grid */}
              {groupPlans.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {groupPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      appeal={appeal}
                      onUpdate={handleUpdatePlan}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white/60 rounded-xl border border-dashed border-gray-200 p-8 text-center">
                  <p className="text-sm text-[#1A1A2E]/30">
                    この訴求にはまだ企画がありません
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <VoiceInputButton
        onTranscript={(text) => console.log("voice:", text)}
      />
    </div>
  );
}
