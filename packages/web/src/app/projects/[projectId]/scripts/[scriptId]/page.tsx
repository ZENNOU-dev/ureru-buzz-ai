"use client";

import { use, useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft, Type, User, Megaphone, Lightbulb,
  ArrowRight, Send, Sparkles, Plus, ChevronDown, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type ScriptRow = {
  id: number;
  zone: "hook"; // フックゾーン
  hookNum: number; // 1, 2, 3
  text: string;
  annotation: string;
  regulationWarning: string;
  regulationConfirm: string;
  feedback: string;
} | {
  id: number;
  zone: "main"; // 本編ゾーン
  section: string; // AI auto-classified
  text: string;
  annotation: string;
  regulationWarning: string;
  regulationConfirm: string;
  feedback: string;
};

// ─── Section Config ───────────────────────────────────
const SECTION_COLORS: Record<string, { badgeBg: string; text: string; border: string }> = {
  "フック1": { badgeBg: "bg-rose-50", text: "text-rose-600", border: "border-l-rose-400" },
  "フック2": { badgeBg: "bg-rose-50", text: "text-rose-500", border: "border-l-rose-300" },
  "フック3": { badgeBg: "bg-purple-50", text: "text-purple-600", border: "border-l-purple-400" },
  共感: { badgeBg: "bg-cyan-50", text: "text-cyan-600", border: "border-l-cyan-400" },
  コンセプト: { badgeBg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-400" },
  権威性: { badgeBg: "bg-indigo-50", text: "text-indigo-600", border: "border-l-indigo-400" },
  商品紹介: { badgeBg: "bg-amber-50", text: "text-amber-700", border: "border-l-amber-400" },
  ベネフィット: { badgeBg: "bg-purple-50", text: "text-purple-600", border: "border-l-purple-400" },
  オファー: { badgeBg: "bg-orange-50", text: "text-orange-600", border: "border-l-orange-400" },
  CTA: { badgeBg: "bg-pink-50", text: "text-pink-600", border: "border-l-pink-400" },
  "": { badgeBg: "bg-gray-100", text: "text-gray-400", border: "border-l-gray-200" },
};

function getRowLabel(row: ScriptRow): string {
  if (row.zone === "hook") return `フック${row.hookNum}`;
  return row.section;
}

function getRowColors(row: ScriptRow) {
  const label = getRowLabel(row);
  return SECTION_COLORS[label] || SECTION_COLORS[""];
}

const STATUS_OPTIONS = [
  { value: "下書き", bg: "bg-gray-100", text: "text-gray-600" },
  { value: "作成中", bg: "bg-amber-50", text: "text-amber-700" },
  { value: "承認待ち", bg: "bg-cyan-50", text: "text-cyan-700" },
  { value: "承認済", bg: "bg-emerald-50", text: "text-emerald-700" },
];

// ─── Sample Data ──────────────────────────────────────
const SAMPLE_APPEAL = {
  name: "AIとSNSを組み合わせた新世代フリーランス",
  who: "会社員で給料・環境に\n不満を持つ\n20〜30代",
  what: "AI活用\nフリーランスとして\n収入アップ",
  why: "AIスキル×SNS運用で\n未経験からでも\n短期間で成果が出せる",
  usp: "実践的なAIツール提供\n＋\n連続起業家監修",
};

const SAMPLE_PLAN = {
  name: "フリーランス2.0体験談",
  interestType: "体験談 /\nビフォーアフター",
  structureType: "フック→共感→\nコンセプト→\n商品紹介→\nベネフィット→CTA",
  fvText: "未経験なら\nAIフリーランス\nめちゃチャンスです",
  concept: "AIとSNSを\n組み合わせた\n新世代フリーランス",
};

// ─── ID generator ────────────────────────────────────
let _nextId = 100;
function nextId() { return _nextId++; }

// ─── Initial Data ────────────────────────────────────
function makeInitialRows(): ScriptRow[] {
  const hooks: ScriptRow[] = [
    { id: nextId(), zone: "hook", hookNum: 1, text: "未経験なら\nAIフリーランス\nめちゃチャンスです🥺", annotation: "全体に常時表示\n※個人の感想であり効果を保証するものではありません", regulationWarning: "", regulationConfirm: "", feedback: "" },
    { id: nextId(), zone: "hook", hookNum: 2, text: "AIのおかげで\n収入変わりすぎて\n正直びっくり🤩", annotation: "", regulationWarning: "", regulationConfirm: "", feedback: "" },
    { id: nextId(), zone: "hook", hookNum: 3, text: "給料・職場環境\n変わらない\n会社員辞めて", annotation: "", regulationWarning: "", regulationConfirm: "", feedback: "" },
    { id: nextId(), zone: "hook", hookNum: 3, text: "AIフリーランスに\n転身したら・・・", annotation: "", regulationWarning: "", regulationConfirm: "", feedback: "" },
    { id: nextId(), zone: "hook", hookNum: 3, text: "バブルすぎて\nびっくりしてます😭", annotation: "", regulationWarning: "", regulationConfirm: "", feedback: "" },
  ];

  const mainData = [
    { text: "私は\nAIとXを使って\n会社員時代の月収を上回る\nフリーランス", section: "商品紹介" },
    { text: "初めは\nAI使わなきゃな〜\nって", section: "商品紹介" },
    { text: "チャッピー愛用\nしてたけど", section: "商品紹介" },
    { text: "仕事で使えなくて挫折", section: "商品紹介" },
    { text: "そんな時に\n出会ったのが", section: "商品紹介" },
    { text: "SNS投稿用\nオリジナルAIを\n使わせてもらえる", section: "商品紹介" },
    { text: "AI時代の\nフリーランススクール\nDOT-AI BOOTCAMP", section: "商品紹介" },
    { text: "マーケで成功してる\n連続起業家\n発案だから", section: "権威性" },
    { text: "SNSでの\nフリーランス\nロードマップが", section: "商品紹介" },
    { text: "分かりやすく\n学習できたし、", section: "商品紹介" },
    { text: "SNS投稿を\n半自動で作れる\nツールのおかげで", section: "ベネフィット" },
    { text: "アイデア出しと\n調整だけで\n万バズいっぱい✌️", section: "ベネフィット" },
    { text: "AIで仕事の効率\n上がったおかげで", section: "CTA" },
    { text: "3ヶ月で\n会社員時代の\n収入額更新✨", section: "CTA" },
  ];

  const mains: ScriptRow[] = mainData.map((d) => ({
    id: nextId(),
    zone: "main" as const,
    section: d.section,
    text: d.text,
    annotation: "",
    regulationWarning: "",
    regulationConfirm: "",
    feedback: "",
  }));

  return [...hooks, ...mains];
}

// ─── Auto-resize textarea component ──────────────────
function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  className,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

  const resize = useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);
  useEffect(() => {
    const raf = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(raf);
  }, [resize]);

  const isExpandable = className?.includes("h-full");
  const isEmpty = !value;

  // 空の状態 & フォーカスなし & h-full（行高さ追従セル）の場合、中央配置のplaceholderを表示
  if (isExpandable && isEmpty && !focused) {
    return (
      <div
        onClick={() => {
          setFocused(true);
          requestAnimationFrame(() => localRef.current?.focus());
        }}
        className="w-full h-full flex items-center justify-center cursor-text rounded-lg hover:border-black/[0.08] hover:bg-black/[0.01] border border-transparent transition-colors"
      >
        <span className="text-[11px] text-[#1A1A2E]/20">{placeholder}</span>
        {/* Hidden textarea for ref */}
        <textarea
          ref={(el) => { localRef.current = el; inputRef?.(el); }}
          value=""
          onChange={(e) => { onChange(e.target.value); setFocused(true); }}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    );
  }

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        inputRef?.(el);
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      rows={1}
      className={`w-full bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2 py-1.5 outline-none resize-none overflow-hidden text-[12px] leading-relaxed text-[#1A1A2E]/80 placeholder:text-[#1A1A2E]/20 hover:bg-black/[0.01] ${className ?? ""}`}
      style={{ minHeight: isExpandable ? "100%" : "28px" }}
    />
  );
}

// ─── Cards (unified grid) ─────────────────────────────
const CARD_GROUPS = [
  {
    groupLabel: "訴求",
    groupName: SAMPLE_APPEAL.name,
    icon: "megaphone" as const,
    color: { icon: "bg-rose-50 text-rose-500", label: "text-rose-500", cardLabel: "text-rose-500" },
    cards: [
      { label: "WHO", value: SAMPLE_APPEAL.who },
      { label: "WHAT", value: SAMPLE_APPEAL.what },
      { label: "WHY", value: SAMPLE_APPEAL.why },
      { label: "USP", value: SAMPLE_APPEAL.usp },
    ],
  },
  {
    groupLabel: "広告企画",
    groupName: SAMPLE_PLAN.name,
    icon: "lightbulb" as const,
    color: { icon: "bg-amber-50 text-amber-600", label: "text-amber-600", cardLabel: "text-amber-600" },
    cards: [
      { label: "興味の型", value: SAMPLE_PLAN.interestType },
      { label: "構成の型", value: SAMPLE_PLAN.structureType },
      { label: "FV", value: SAMPLE_PLAN.fvText },
    ],
  },
];

// ─── Undo history ─────────────────────────────────────
type HistoryEntry = {
  rows: ScriptRow[];
};

// ─── Main Page ────────────────────────────────────────
export default function ScriptDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; scriptId: string }>;
}) {
  const { projectId } = use(params);
  const [rows, setRows] = useState<ScriptRow[]>(makeInitialRows);
  const [title, setTitle] = useState(SAMPLE_PLAN.name);
  const [status, setStatus] = useState("作成中");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [speaker, setSpeaker] = useState("女性ナレーター");

  // Hook collapse state: collapsed by default (show only 1st row per hookNum)
  const [expandedHooks, setExpandedHooks] = useState<Record<number, boolean>>({});
  const toggleHook = useCallback((hookNum: number) => {
    setExpandedHooks((prev) => ({ ...prev, [hookNum]: !prev[hookNum] }));
  }, []);

  // Undo history (max 50)
  const historyRef = useRef<HistoryEntry[]>([]);
  const pushHistory = useCallback((currentRows: ScriptRow[]) => {
    historyRef.current.push({ rows: currentRows });
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, []);

  // Text refs for focus management
  const textRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [focusId, setFocusId] = useState<number | null>(null);

  // Track which row is currently focused (for voice input)
  const activeRowIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusId !== null) {
      const el = textRefs.current[focusId];
      if (el) { el.focus(); setFocusId(null); }
    }
  });

  // ─── Voice input handlers ───────────────────────────
  const handleVoiceTranscript = useCallback((text: string) => {
    const targetId = activeRowIdRef.current ?? rows[rows.length - 1]?.id;
    if (!targetId) return;
    setRows((prev) => prev.map((r) => {
      if (r.id !== targetId) return r;
      const current = r.text;
      return { ...r, text: current ? current + "\n" + text : text };
    }));
  }, [rows]);

  const handleVoiceFeedback = useCallback((text: string) => {
    const targetId = activeRowIdRef.current ?? rows[rows.length - 1]?.id;
    if (!targetId) return;
    setRows((prev) => prev.map((r) => {
      if (r.id !== targetId) return r;
      const current = r.feedback;
      return { ...r, feedback: current ? current + "\n" + text : text };
    }));
  }, [rows]);

  // ─── Row operations ─────────────────────────────────
  const updateRow = useCallback((rowId: number, field: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    );
  }, []);

  const addRowAfter = useCallback((afterIdx: number, zone: "hook" | "main", hookNum?: number) => {
    setRows((prev) => {
      pushHistory(prev);
      const newId = nextId();
      const newRow: ScriptRow = zone === "hook"
        ? { id: newId, zone: "hook", hookNum: hookNum ?? 1, text: "", annotation: "", regulationWarning: "", regulationConfirm: "", feedback: "" }
        : { id: newId, zone: "main", section: "", text: "", annotation: "", regulationWarning: "", regulationConfirm: "", feedback: "" };
      const next = [...prev];
      next.splice(afterIdx + 1, 0, newRow);
      setFocusId(newId);
      return next;
    });
  }, [pushHistory]);

  const deleteRow = useCallback((rowId: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      pushHistory(prev);
      const idx = prev.findIndex((r) => r.id === rowId);
      const next = prev.filter((r) => r.id !== rowId);
      // Focus adjacent row
      if (idx > 0) setFocusId(next[idx - 1]?.id ?? null);
      else if (next.length > 0) setFocusId(next[0]?.id ?? null);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    const entry = historyRef.current.pop();
    if (entry) setRows(entry.rows);
  }, []);

  // ─── Global keyboard: Cmd+Z ─────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  // ─── Key handlers ───────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIdx: number) => {
    const row = rows[rowIdx];
    if (!row) return;

    // Enter key
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (row.zone === "hook") {
        // フック行: 同じhookNum の行を直下に追加（フック内で行を増やす）
        const hn = (row as any).hookNum as number;
        setExpandedHooks((prev) => ({ ...prev, [hn]: true })); // auto-expand
        addRowAfter(rowIdx, "hook", hn);
      } else {
        // 本編行: 次の行にフォーカス、最終行なら新規追加
        const nextRow = rows[rowIdx + 1];
        if (nextRow) {
          textRefs.current[nextRow.id]?.focus();
        } else {
          addRowAfter(rowIdx, "main");
        }
      }
      return;
    }

    // Delete / Backspace on empty text → delete row
    if ((e.key === "Delete" || (e.key === "Backspace" && !row.text)) && !row.text) {
      e.preventDefault();
      deleteRow(row.id);
      return;
    }
  }, [rows, addRowAfter, deleteRow]);

  // ─── Computed values ────────────────────────────────
  const totalChars = useMemo(
    () => rows.reduce((sum, r) => sum + r.text.replace(/\n/g, "").length, 0),
    [rows],
  );

  const filledCount = useMemo(
    () => rows.filter((r) => r.text.trim()).length,
    [rows],
  );

  // Find where hooks end and main begins
  const hookEndIdx = useMemo(() => {
    let last = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].zone === "hook") last = i;
    }
    return last;
  }, [rows]);

  const statusOption = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  // ─── Table columns ─────────────────────────────────
  const TABLE_COLS = "grid-cols-[32px_64px_1fr_32px_1fr_1fr_1fr_1fr]";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 py-3 flex items-center gap-3">
          <Link
            href={`/projects`}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => { setEditingTitle(false); setTitle(titleDraft); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setEditingTitle(false); setTitle(titleDraft); }
                if (e.key === "Escape") { setTitleDraft(title); setEditingTitle(false); }
              }}
              className="text-lg font-bold text-[#1A1A2E] bg-transparent border-b-2 border-[#9333EA] outline-none flex-1"
            />
          ) : (
            <h1
              onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
              className="text-lg font-bold text-[#1A1A2E] cursor-text hover:bg-black/[0.02] rounded px-1 -mx-1 transition-colors flex-1"
            >
              {title}
            </h1>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full border-0 outline-none cursor-pointer appearance-none ${statusOption.bg} ${statusOption.text}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.value}</option>
            ))}
          </select>
        </div>
        <div className="px-6 pb-3 flex items-center gap-6 text-xs text-[#1A1A2E]/40">
          <div className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            <span>全体文字数: <span className="font-semibold text-[#1A1A2E]">{totalChars}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>話者設定:</span>
            <input
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none text-xs font-semibold text-[#1A1A2E] w-[120px] px-0.5"
            />
          </div>
          <div className="text-[#1A1A2E]/15">|</div>
          <span>{filledCount}シーン</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Cards + Action Buttons */}
          {/* Cards: 訴求(4) + 広告企画(3) + 次へ進む(2) = 9列 統一グリッド */}
          <div>
            {/* Group headers */}
            <div className="grid grid-cols-9 gap-2 mb-2">
              <div className="col-span-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-rose-50 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-[14px] font-bold text-rose-500 tracking-wider">コンセプト</span>
                <span className="text-[15px] font-bold text-[#1A1A2E] ml-1 truncate">{SAMPLE_APPEAL.name}</span>
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-[14px] font-bold text-amber-600 tracking-wider">広告企画</span>
                <span className="text-[15px] font-bold text-[#1A1A2E] ml-1 truncate">{SAMPLE_PLAN.name}</span>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-[14px] font-bold text-blue-500 tracking-wider">次へ進む</span>
              </div>
            </div>
            {/* Cards grid */}
            <div className="grid grid-cols-9 gap-2">
              {/* 訴求 4枚 */}
              {CARD_GROUPS[0].cards.map((item) => (
                <div key={item.label} className="content-card rounded-xl p-3 aspect-square overflow-hidden flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-bold text-rose-500 uppercase mb-1.5">{item.label}</span>
                  <span className="text-[13px] text-[#1A1A2E]/80 leading-relaxed whitespace-pre-line">{item.value}</span>
                </div>
              ))}
              {/* 広告企画 3枚 */}
              {CARD_GROUPS[1].cards.map((item) => (
                <div key={item.label} className="content-card rounded-xl p-3 aspect-square overflow-hidden flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-bold text-amber-600 uppercase mb-1.5">{item.label}</span>
                  <span className="text-[13px] text-[#1A1A2E]/80 leading-relaxed whitespace-pre-line">{item.value}</span>
                </div>
              ))}
              {/* 次へ進む 2枚 */}
              <button className="content-card rounded-xl p-3 aspect-square overflow-hidden flex flex-col items-center justify-center gap-2.5 text-center content-card-hover transition-all hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                  <Send className="w-5 h-5 text-cyan-600" />
                </div>
                <span className="text-[12px] font-bold text-[#1A1A2E]/60 leading-tight">クライアント<br/>チェック</span>
              </button>
              <Link
                href={`/projects/${projectId}/edit-brief`}
                className="content-card rounded-xl p-3 aspect-square overflow-hidden flex flex-col items-center justify-center gap-2.5 text-center content-card-hover transition-all hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-[12px] font-bold text-[#1A1A2E]/60 leading-tight">編集概要へ<br/>進む</span>
              </Link>
            </div>
          </div>

          {/* ── Unified Table ── */}
          <div className="content-card rounded-xl overflow-hidden">
            {/* Sticky Header */}
            <div className={`grid ${TABLE_COLS} bg-[#FAF8F5] border-b border-black/[0.06] text-[10px] font-bold text-[#1A1A2E]/40 tracking-wider sticky top-0 z-10 items-center`}>
              <div className="px-1 py-2.5 text-center">#</div>
              <div className="px-1 py-2.5">パート</div>
              <div className="px-2 py-2.5 text-center">テキスト</div>
              <div className="px-0 py-2.5 text-center">文字数</div>
              <div className="px-3 py-2.5">注釈</div>
              <div className="px-2 py-2.5">レギュレーション警告</div>
              <div className="px-2 py-2.5">レギュレーション確認</div>
              <div className="px-2 py-2.5">フィードバック</div>
            </div>

            {/* Rows */}
            <div>
              {(() => {
                // Pre-compute: for each hook row, is it the first row of its hookNum group?
                const hookGroupFirstIdx: Record<number, number> = {};
                const hookGroupCounts: Record<number, number> = {};
                rows.forEach((r, i) => {
                  if (r.zone === "hook") {
                    const hn = (r as any).hookNum as number;
                    if (!(hn in hookGroupFirstIdx)) hookGroupFirstIdx[hn] = i;
                    hookGroupCounts[hn] = (hookGroupCounts[hn] ?? 0) + 1;
                  }
                });

                let displayNum = 0;
                return rows.map((row, idx) => {
                  const label = getRowLabel(row);
                  const colors = getRowColors(row);
                  const isEmpty = !row.text;

                  // Hook collapse logic
                  if (row.zone === "hook") {
                    const hn = (row as any).hookNum as number;
                    const isFirstInGroup = hookGroupFirstIdx[hn] === idx;
                    const isExpanded = expandedHooks[hn] ?? false;
                    const groupCount = hookGroupCounts[hn] ?? 1;

                    // If collapsed and not first row of group → skip rendering
                    if (!isExpanded && !isFirstInGroup) return null;

                    displayNum++;
                  } else {
                    displayNum++;
                  }

                  const num = displayNum;

                  // Divider between hook and main zones
                  const isFirstMain = row.zone === "main" && (idx === 0 || rows[idx - 1].zone === "hook");

                  // Thin divider between different hookNum groups
                  const prevRow = idx > 0 ? rows[idx - 1] : null;
                  const isNewHookGroup = row.zone === "hook" && prevRow?.zone === "hook"
                    && (prevRow as any).hookNum !== (row as any).hookNum;

                  // Hook toggle info
                  const isHookFirstRow = row.zone === "hook" && hookGroupFirstIdx[(row as any).hookNum] === idx;
                  const hookNum = row.zone === "hook" ? (row as any).hookNum as number : 0;
                  const hookGroupCount = row.zone === "hook" ? (hookGroupCounts[hookNum] ?? 1) : 0;
                  const hookExpanded = row.zone === "hook" ? (expandedHooks[hookNum] ?? false) : false;

                  return (
                    <div key={row.id}>
                      {/* Thin divider between hook groups */}
                      {isNewHookGroup && (
                        <div className="h-px bg-rose-100 mx-4" />
                      )}

                      {/* Zone divider (フック → 本編) */}
                      {isFirstMain && (
                        <div className="flex items-center gap-3 px-4 py-1.5 bg-[#FAF8F5]/50">
                          <div className="h-px flex-1 bg-black/[0.06]" />
                          <span className="text-[9px] font-bold text-[#1A1A2E]/20 uppercase tracking-widest">本編</span>
                          <div className="h-px flex-1 bg-black/[0.06]" />
                        </div>
                      )}

                      {/* Row */}
                      <div className={`grid ${TABLE_COLS} items-stretch border-l-[3px] ${colors.border} border-b border-black/[0.03] ${isEmpty ? "opacity-50 hover:opacity-80" : "hover:bg-black/[0.01]"} transition-all`}>
                        {/* # */}
                        <div className="px-1 py-2 text-[11px] font-semibold text-[#1A1A2E]/40 text-center flex items-center justify-center">
                          {String(num).padStart(2, "0")}
                        </div>

                        {/* パート — toggle only when hook has 2+ rows */}
                        <div className="px-1 py-1.5 flex items-center">
                          {isHookFirstRow && hookGroupCount > 1 ? (
                            <button
                              onClick={() => toggleHook(hookNum)}
                              className={`text-[9px] font-bold px-1 py-0.5 rounded-md text-center w-full flex items-center justify-center gap-0.5 ${colors.badgeBg} ${colors.text} hover:opacity-80 transition-opacity`}
                            >
                              {hookExpanded ? (
                                <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                              ) : (
                                <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                              )}
                              {label}
                            </button>
                          ) : label ? (
                            <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md text-center w-full ${colors.badgeBg} ${colors.text}`}>
                              {label}
                            </div>
                          ) : (
                            <div className="text-[9px] text-[#1A1A2E]/15 text-center py-0.5 w-full">
                              <Sparkles className="w-3 h-3 mx-auto" />
                            </div>
                          )}
                        </div>

                      {/* テキスト */}
                      <div className="px-1 py-0.5 min-h-[32px]">
                        <AutoTextarea
                          value={row.text}
                          onChange={(v) => updateRow(row.id, "text", v)}
                          onKeyDown={(e) => handleKeyDown(e, idx)}
                          onFocus={() => { activeRowIdRef.current = row.id; }}
                          placeholder="テキスト..."
                          className="text-xs leading-relaxed w-full text-center"
                          inputRef={(el) => { textRefs.current[row.id] = el; }}
                        />
                      </div>

                      {/* 文字数 */}
                      <div className="px-0 py-2 text-[10px] font-medium text-[#1A1A2E]/40 text-center flex items-center justify-center">
                        {row.text ? row.text.replace(/\n/g, "").length : ""}
                      </div>

                      {/* 注釈 */}
                      <div className={`px-1.5 py-0.5 flex ${row.annotation ? "" : "items-center"}`}>
                        <AutoTextarea
                          value={row.annotation}
                          onChange={(v) => updateRow(row.id, "annotation", v)}
                          placeholder="注釈"
                          className="text-[11px] leading-relaxed w-full h-full"
                        />
                      </div>

                      {/* レギュレーション警告 */}
                      <div className="px-2 py-2 flex items-center">
                        {row.regulationWarning ? (
                          <div className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 leading-relaxed">
                            {row.regulationWarning}
                          </div>
                        ) : row.text ? (
                          <span className="text-[10px] text-[#1A1A2E]/15 italic">AI自動判定</span>
                        ) : null}
                      </div>

                      {/* レギュレーション確認 */}
                      <div className={`px-1 py-0.5 flex ${row.regulationConfirm ? "" : "items-center"}`}>
                        <AutoTextarea
                          value={row.regulationConfirm}
                          onChange={(v) => updateRow(row.id, "regulationConfirm", v)}
                          placeholder="クライアント確認"
                          className="text-[11px] leading-relaxed w-full h-full"
                        />
                      </div>

                      {/* フィードバック */}
                      <div className={`px-1 py-0.5 flex ${row.feedback ? "" : "items-center"}`}>
                        <AutoTextarea
                          value={row.feedback}
                          onChange={(v) => updateRow(row.id, "feedback", v)}
                          onFocus={() => { activeRowIdRef.current = row.id; }}
                          placeholder="FB記入→AI改善"
                          className="text-[11px] leading-relaxed w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                  );
                });
              })()}
            </div>

            {/* Add row button at bottom */}
            <button
              onClick={() => {
                const lastRow = rows[rows.length - 1];
                addRowAfter(rows.length - 1, lastRow?.zone === "hook" ? "main" : "main");
              }}
              className="w-full py-2 text-[10px] text-[#1A1A2E]/25 hover:text-[#1A1A2E]/50 hover:bg-black/[0.01] transition-all flex items-center justify-center gap-1 border-t border-black/[0.04]"
            >
              <Plus className="w-3 h-3" />
              行を追加
            </button>
          </div>
        </div>
      </div>

      {/* Voice input floating button */}
      <VoiceInputButton
        onTranscript={handleVoiceTranscript}
        onFeedback={handleVoiceFeedback}
      />
    </div>
  );
}
