"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft, Music, Plus, X, ArrowRight, Mic, Download, Share2,
} from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type TelopPosition = { x: number; y: number };

type EditBriefRow = {
  id: number;
  section: string;
  scriptText: string;
  annotation: string;
  annotationPlacement: "左上" | "右下" | "テロップ追加";
  annotationPos: TelopPosition;
  telop: string;
  telopPosition: TelopPosition;
  telopSize: number;          // 6-14px range
  annotationSize: number;     // 4-10px range
  fontOverride: string;
  fontHighlights: FontHighlight[];
  bgmChange: boolean;         // "ここからBGM変更" flag
  bgmValue: string;           // new BGM name
  mainMaterial: string;
  subMaterials: string[];
  materialImageUrl: string;
  motionEffect: string;
  motionTarget: string;
  soundEffect: string;
};

type FontHighlight = { text: string; font: string };

// ─── Constants ───────────────────────────────────────
const SECTION_COLORS: Record<string, { badgeBg: string; text: string; border: string }> = {
  "フック1": { badgeBg: "bg-rose-50", text: "text-rose-600", border: "border-t-rose-400" },
  "フック2": { badgeBg: "bg-rose-50", text: "text-rose-500", border: "border-t-rose-300" },
  "フック3": { badgeBg: "bg-purple-50", text: "text-purple-600", border: "border-t-purple-400" },
  共感: { badgeBg: "bg-cyan-50", text: "text-cyan-600", border: "border-t-cyan-400" },
  コンセプト: { badgeBg: "bg-emerald-50", text: "text-emerald-600", border: "border-t-emerald-400" },
  権威性: { badgeBg: "bg-indigo-50", text: "text-indigo-600", border: "border-t-indigo-400" },
  商品紹介: { badgeBg: "bg-amber-50", text: "text-amber-700", border: "border-t-amber-400" },
  ベネフィット: { badgeBg: "bg-purple-50", text: "text-purple-600", border: "border-t-purple-400" },
  オファー: { badgeBg: "bg-orange-50", text: "text-orange-600", border: "border-t-orange-400" },
  CTA: { badgeBg: "bg-pink-50", text: "text-pink-600", border: "border-t-pink-400" },
  "": { badgeBg: "bg-gray-100", text: "text-gray-400", border: "border-t-gray-200" },
};

const STATUS_OPTIONS = [
  { value: "下書き", bg: "bg-gray-100", text: "text-gray-600" },
  { value: "作成中", bg: "bg-amber-50", text: "text-amber-700" },
  { value: "承認待ち", bg: "bg-cyan-50", text: "text-cyan-700" },
  { value: "承認済", bg: "bg-emerald-50", text: "text-emerald-700" },
];

const FONT_OPTIONS = ["ゴシック体", "明朝体", "手書き風", "丸ゴシック", "教科書体", "ポップ体"];
const ME_OPTIONS = ["フェードイン", "スライドイン", "ズーム", "バウンス", "フラッシュ", "シェイク", "回転", "ぼかし→鮮明", "パララックス"];
const SE_OPTIONS = ["キラキラ", "ドン！", "シュッ", "ポップ", "決定音", "衝撃音", "タイプ音", "チャイム", "風切り音"];

const VOICE_OPTIONS = [
  { value: "machine_zundamon", label: "ずんだもん（機械音声）", group: "機械音声" },
  { value: "machine_metan", label: "四国めたん（機械音声）", group: "機械音声" },
  { value: "machine_tsumugi", label: "春日部つむぎ（機械音声）", group: "機械音声" },
  { value: "machine_other", label: "その他の機械音声", group: "機械音声" },
  { value: "voice_actor", label: "声優データを選択...", group: "声優" },
];

const ANNOTATION_PLACEMENTS = ["左上", "右下", "テロップ追加"] as const;

// ─── ID generator ────────────────────────────────────
let _nextId = 200;
function nextId() { return _nextId++; }

// ─── Sample Data ─────────────────────────────────────
function makeInitialRows(): EditBriefRow[] {
  const data = [
    { section: "フック1", scriptText: "未経験なら\nAIフリーランス\nめちゃチャンスです🥺", annotation: "全体に常時表示\n※個人の感想であり効果を保証するものではありません" },
    { section: "フック2", scriptText: "AIのおかげで\n収入変わりすぎて\n正直びっくり🤩", annotation: "" },
    { section: "フック3", scriptText: "給料・職場環境\n変わらない\n会社員辞めて", annotation: "" },
    { section: "フック3", scriptText: "AIフリーランスに\n転身したら・・・", annotation: "" },
    { section: "フック3", scriptText: "バブルすぎて\nびっくりしてます😭", annotation: "" },
    { section: "商品紹介", scriptText: "私は\nAIとXを使って\n会社員時代の月収を上回る\nフリーランス", annotation: "" },
    { section: "商品紹介", scriptText: "初めは\nAI使わなきゃな〜\nって", annotation: "" },
    { section: "商品紹介", scriptText: "チャッピー愛用\nしてたけど", annotation: "" },
    { section: "商品紹介", scriptText: "仕事で使えなくて挫折", annotation: "" },
    { section: "商品紹介", scriptText: "そんな時に\n出会ったのが", annotation: "" },
    { section: "商品紹介", scriptText: "SNS投稿用\nオリジナルAIを\n使わせてもらえる", annotation: "" },
    { section: "商品紹介", scriptText: "AI時代の\nフリーランススクール\nDOT-AI BOOTCAMP", annotation: "" },
    { section: "権威性", scriptText: "マーケで成功してる\n連続起業家\n発案だから", annotation: "" },
    { section: "ベネフィット", scriptText: "SNS投稿を\n半自動で作れる\nツールのおかげで", annotation: "" },
    { section: "ベネフィット", scriptText: "アイデア出しと\n調整だけで\n万バズいっぱい✌️", annotation: "" },
    { section: "CTA", scriptText: "AIで仕事の効率\n上がったおかげで", annotation: "" },
    { section: "CTA", scriptText: "3ヶ月で\n会社員時代の\n収入額更新✨", annotation: "" },
  ];

  return data.map((d) => ({
    id: nextId(),
    section: d.section,
    scriptText: d.scriptText,
    annotation: d.annotation,
    annotationPlacement: "左上" as const,
    annotationPos: { x: 15, y: 12 },
    telop: d.scriptText,
    telopPosition: { x: 50, y: 75 },
    telopSize: 8,
    annotationSize: 6,
    fontOverride: "",
    fontHighlights: [],
    bgmChange: false,
    bgmValue: "",
    mainMaterial: "",
    subMaterials: [""],
    materialImageUrl: "",
    motionEffect: "",
    motionTarget: "",
    soundEffect: "",
  }));
}

// ─── Auto-resize textarea ────────────────────────────
function AutoTextarea({ value, onChange, placeholder, className, readOnly }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; className?: string; readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = useCallback(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }, []);
  useEffect(() => { resize(); }, [value, resize]);
  useEffect(() => { const r = requestAnimationFrame(resize); return () => cancelAnimationFrame(r); }, [resize]);
  return (
    <textarea ref={ref} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly} rows={1}
      className={`w-full bg-transparent border border-transparent ${readOnly ? "" : "hover:border-black/[0.08] focus:border-[#9333EA]/40 hover:bg-black/[0.01]"} rounded-lg px-2 py-1 outline-none resize-none overflow-hidden text-[11px] leading-relaxed text-[#1A1A2E]/80 placeholder:text-[#1A1A2E]/20 ${readOnly ? "text-[#1A1A2E]/50 cursor-default" : ""} ${className ?? ""}`}
      style={{ minHeight: "24px" }}
    />
  );
}

// ─── Smart Select (top 3 + "その他" expander) ────────
function SmartSelect({ value, options, topCount = 3, onChange, placeholder }: {
  value: string; options: string[]; topCount?: number; onChange: (v: string) => void; placeholder?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const topOptions = options.slice(0, topCount);
  const restOptions = options.slice(topCount);
  const isInRest = restOptions.includes(value);

  if (showAll) {
    return (
      <div className="flex flex-col gap-1">
        <select value={value} onChange={(e) => { onChange(e.target.value); setShowAll(false); }}
          onBlur={() => setShowAll(false)} autoFocus
          className="w-full bg-transparent border border-[#9333EA]/30 rounded-lg px-1.5 py-1 outline-none text-[10px] text-[#1A1A2E]/70 cursor-pointer">
          <option value="">{placeholder ?? "選択してください"}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <select value={isInRest ? "__other__" : value}
      onChange={(e) => {
        if (e.target.value === "__other__") { setShowAll(true); }
        else onChange(e.target.value);
      }}
      className="w-full bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-1.5 py-1 outline-none text-[10px] text-[#1A1A2E]/70 cursor-pointer appearance-none">
      <option value="">{placeholder ?? "—"}</option>
      {topOptions.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__other__">{isInRest ? `その他: ${value}` : "その他..."}</option>
    </select>
  );
}

// ─── Video Image Preview ─────────────────────────────
function VideoImagePreview({ row, idx, onUpdate }: {
  row: EditBriefRow;
  idx: number;
  onUpdate: (field: string, value: any) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<"telop" | "annotation" | null>(null);

  const handlePointerDown = useCallback((target: "telop" | "annotation") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(target);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragTarget || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    if (dragTarget === "telop") onUpdate("telopPosition", { x, y });
    else onUpdate("annotationPos", { x, y });
  }, [dragTarget, onUpdate]);

  const handlePointerUp = useCallback(() => setDragTarget(null), []);

  // Scroll wheel to resize telop/annotation
  const handleWheel = useCallback((target: "telopSize" | "annotationSize", current: number, min: number, max: number) => (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    onUpdate(target, Math.max(min, Math.min(max, current + delta)));
  }, [onUpdate]);

  const telopLines = row.telop.split("\n").filter(l => l.trim());

  // Annotation default positions
  const annoDefaults: Record<string, TelopPosition> = {
    "左上": { x: 15, y: 12 },
    "右下": { x: 85, y: 88 },
    "テロップ追加": { x: 50, y: 60 },
  };

  return (
    <div
      ref={frameRef}
      className="w-full aspect-[9/16] rounded-[14px] border-2 border-[#1A1A2E]/10 bg-[#0a0a0a] relative overflow-hidden flex flex-col select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Notch */}
      <div className="w-[24px] h-[4px] bg-white/20 rounded-full mx-auto mt-[5px] shrink-0 z-10" />
      {/* Screen */}
      <div className="flex-1 mx-[3px] mb-[5px] mt-[3px] rounded-[6px] relative overflow-hidden">
        {row.materialImageUrl ? (
          <img src={row.materialImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e]/50 to-[#1a1a2e]/80" />
        )}

        {/* Scene number + section badge at top center */}
        <div className="absolute top-[4px] left-0 right-0 z-[15] flex items-center justify-center gap-1 pointer-events-none">
          <span className="text-[5px] font-bold text-white/50">{String(idx + 1).padStart(2, "0")}</span>
          {row.section && (() => {
            const c = SECTION_COLORS[row.section] || SECTION_COLORS[""];
            return <span className={`text-[5px] font-bold px-1 py-[0.5px] rounded-sm ${c.badgeBg} ${c.text} opacity-90`}>{row.section}</span>;
          })()}
        </div>

        {/* Annotation box (draggable) */}
        {row.annotation && (
          <div
            className={`absolute z-[8] cursor-grab active:cursor-grabbing ${dragTarget === "annotation" ? "opacity-70" : ""}`}
            style={{
              left: `${row.annotationPos.x}%`,
              top: `${row.annotationPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={handlePointerDown("annotation")}
            onWheel={handleWheel("annotationSize", row.annotationSize, 4, 10)}
          >
            <div
              className="border border-white/50 bg-black/30 rounded-sm px-1 py-[1px] text-white/70 whitespace-nowrap"
              style={{ fontSize: `${row.annotationSize}px` }}
            >
              注釈
            </div>
          </div>
        )}

        {/* Telop (draggable) */}
        {telopLines.length > 0 && (
          <div
            className={`absolute z-10 cursor-grab active:cursor-grabbing ${dragTarget === "telop" ? "opacity-70" : ""}`}
            style={{
              left: `${row.telopPosition.x}%`,
              top: `${row.telopPosition.y}%`,
              transform: "translate(-50%, -50%)",
              maxWidth: "92%",
            }}
            onPointerDown={handlePointerDown("telop")}
            onWheel={handleWheel("telopSize", row.telopSize, 5, 14)}
          >
            <div className="text-center">
              {telopLines.map((line, i) => (
                <div key={i} className="text-white font-bold leading-tight whitespace-nowrap"
                  style={{ fontSize: `${row.telopSize}px`, textShadow: "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.7)" }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Material label */}
        {row.mainMaterial && (
          <div className="absolute bottom-[3px] left-[3px] right-[3px] z-[5]">
            <div className="text-[5px] text-white/50 bg-black/30 rounded-sm px-1 py-[1px] text-center truncate">{row.mainMaterial}</div>
          </div>
        )}

        {/* BGM change indicator */}
        {row.bgmChange && (
          <div className="absolute top-[3px] left-[3px] z-[12]">
            <div className="text-[4px] text-yellow-300 bg-black/50 rounded-sm px-1 py-[1px] flex items-center gap-0.5">
              ♪ BGM変更
            </div>
          </div>
        )}
      </div>
      {/* Home bar */}
      <div className="w-[20px] h-[3px] bg-white/20 rounded-full mx-auto mb-[4px] shrink-0" />
    </div>
  );
}

// ─── Field Label ─────────────────────────────────────
function FieldLabel({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-0.5">
      <span className="text-[11px] font-bold text-[#1A1A2E]/60 uppercase tracking-wider px-1">{label}</span>
      {right}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function EditBriefPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [rows, setRows] = useState<EditBriefRow[]>(makeInitialRows);
  const [title, setTitle] = useState("フリーランス2.0体験談");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("フリーランス2.0体験談");
  const [status, setStatus] = useState("作成中");
  const [globalBgm, setGlobalBgm] = useState("BGM-01: アップテンポ・ポジティブ");
  const [globalFont, setGlobalFont] = useState("ゴシック体");
  const [voiceType, setVoiceType] = useState("machine_zundamon");

  // Scroll sync between top bar and main content
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const syncScroll = useCallback((source: "top" | "main") => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === "top" ? topScrollRef.current : mainScrollRef.current;
    const to = source === "top" ? mainScrollRef.current : topScrollRef.current;
    if (from && to) to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  // Row update
  const updateRow = useCallback((rowId: number, field: string, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  }, []);

  const addSubMaterial = useCallback((rowId: number) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, subMaterials: [...r.subMaterials, ""] } : r));
  }, []);
  const removeSubMaterial = useCallback((rowId: number, idx: number) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const s = r.subMaterials.filter((_, i) => i !== idx);
      return { ...r, subMaterials: s.length > 0 ? s : [""] };
    }));
  }, []);
  const updateSubMaterial = useCallback((rowId: number, idx: number, v: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const s = [...r.subMaterials]; s[idx] = v;
      return { ...r, subMaterials: s };
    }));
  }, []);
  const addFontHighlight = useCallback((rowId: number) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, fontHighlights: [...r.fontHighlights, { text: "", font: "明朝体" }] } : r));
  }, []);
  const removeFontHighlight = useCallback((rowId: number, idx: number) => {
    setRows((prev) => prev.map((r) => r.id !== rowId ? r : { ...r, fontHighlights: r.fontHighlights.filter((_, i) => i !== idx) }));
  }, []);
  const updateFontHighlight = useCallback((rowId: number, idx: number, h: FontHighlight) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const hl = [...r.fontHighlights]; hl[idx] = h;
      return { ...r, fontHighlights: hl };
    }));
  }, []);

  const statusOption = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  const labelWidth = 100;
  const cardWidth = 180;
  const totalWidth = labelWidth + rows.length * cardWidth + 32;

  // Field definitions
  const fieldDefinitions: { key: string; label: string; render: (row: EditBriefRow, idx: number) => React.ReactNode }[] = [
    { key: "text", label: "ナレーション", render: (row) => (
      <AutoTextarea value={row.scriptText} readOnly className="text-[10px]" />
    )},
    { key: "annotation", label: "注釈", render: (row) => (
      <div>
        {row.annotation ? (
          <div className="flex gap-0.5 mb-1">
            {ANNOTATION_PLACEMENTS.map((p) => (
              <button key={p} onClick={() => {
                const defaults: Record<string, TelopPosition> = { "左上": { x: 15, y: 12 }, "右下": { x: 85, y: 88 }, "テロップ追加": { x: 50, y: 60 } };
                updateRow(row.id, "annotationPlacement", p);
                updateRow(row.id, "annotationPos", defaults[p]);
              }}
                className={`text-[7px] px-1 py-0.5 rounded ${row.annotationPlacement === p ? "bg-[#9333EA]/10 text-[#9333EA] font-bold" : "text-[#1A1A2E]/25 hover:text-[#1A1A2E]/50"}`}>
                {p}
              </button>
            ))}
          </div>
        ) : null}
        <AutoTextarea value={row.annotation} onChange={(v) => updateRow(row.id, "annotation", v)} placeholder="注釈を入力" className="text-[10px]" />
      </div>
    )},
    { key: "telop", label: "テロップ", render: (row) => (
      <AutoTextarea value={row.telop} onChange={(v) => updateRow(row.id, "telop", v)} placeholder="テロップ" className="text-[10px]" />
    )},
    { key: "font", label: "フォント\n※変更時", render: (row) => (
      <div>
        <SmartSelect value={row.fontOverride} options={FONT_OPTIONS} topCount={3} onChange={(v) => updateRow(row.id, "fontOverride", v)} placeholder="変更なし" />
        <div className="flex flex-wrap gap-1 mt-1">
          {row.fontHighlights.map((h, i) => (
            <div key={i} className="flex items-center gap-0.5 bg-[#9333EA]/[0.06] rounded px-1 py-0.5 group/chip">
              <input value={h.text} onChange={(e) => updateFontHighlight(row.id, i, { ...h, text: e.target.value })}
                placeholder="文字" className="w-[32px] text-[8px] text-[#1A1A2E]/70 bg-transparent outline-none placeholder:text-[#1A1A2E]/20" />
              <select value={h.font} onChange={(e) => updateFontHighlight(row.id, i, { ...h, font: e.target.value })}
                className="text-[8px] text-[#9333EA] bg-transparent outline-none cursor-pointer appearance-none">
                {FONT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <button onClick={() => removeFontHighlight(row.id, i)} className="text-red-400 opacity-0 group-hover/chip:opacity-100"><X className="w-2 h-2" /></button>
            </div>
          ))}
          <button onClick={() => addFontHighlight(row.id)}
            className="flex items-center gap-0.5 text-[7px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 transition-colors">
            <Plus className="w-2.5 h-2.5" /><span>部分変更</span>
          </button>
        </div>
      </div>
    )},
    { key: "bgm", label: "BGM", render: (row, idx) => {
      let effectiveBgm = globalBgm;
      for (let i = 0; i <= idx; i++) {
        if (rows[i].bgmChange && rows[i].bgmValue) effectiveBgm = rows[i].bgmValue;
      }
      return (
        <div>
          <div className="text-[8px] text-[#1A1A2E]/25 mb-0.5 truncate px-1">♪ {effectiveBgm}</div>
          <button onClick={() => updateRow(row.id, "bgmChange", !row.bgmChange)}
            className={`text-[9px] px-2 py-1 rounded-lg border transition-all w-full text-left ${row.bgmChange ? "bg-yellow-50 border-yellow-200 text-yellow-700 font-semibold" : "border-[#1A1A2E]/[0.06] text-[#1A1A2E]/30 hover:border-[#1A1A2E]/15"}`}>
            {row.bgmChange ? "♪ ここから変更中" : "ここからBGM変更"}
          </button>
        </div>
      );
    }},
    { key: "mainMat", label: "メイン\n素材名", render: (row) => (
      <div className="flex items-start gap-1.5">
        <input value={row.mainMaterial} onChange={(e) => updateRow(row.id, "mainMaterial", e.target.value)}
          placeholder="メイン素材" className="flex-1 min-w-0 text-[10px] text-[#1A1A2E]/70 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2 py-1 outline-none placeholder:text-[#1A1A2E]/20" />
        {row.mainMaterial && (
          <div className="w-[50px] aspect-[9/16] rounded-[4px] border border-[#1A1A2E]/10 bg-gradient-to-b from-[#1a1a2e]/10 to-[#1a1a2e]/20 flex items-center justify-center overflow-hidden shrink-0">
            <span className="text-[5px] text-[#1A1A2E]/50 text-center leading-tight px-0.5 break-all">{row.mainMaterial}</span>
          </div>
        )}
      </div>
    )},
    { key: "subMat", label: "サブ\n素材名", render: (row) => (
      <div>
        {row.subMaterials.map((sub, i) => (
          <div key={i} className="flex items-start gap-0.5 group/sub">
            <input value={sub} onChange={(e) => updateSubMaterial(row.id, i, e.target.value)}
              placeholder="サブ素材" className="flex-1 min-w-0 text-[10px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2 py-0.5 outline-none placeholder:text-[#1A1A2E]/15" />
            {sub && (
              <div className="w-[40px] aspect-[9/16] rounded-[3px] border border-[#1A1A2E]/10 bg-gradient-to-b from-[#1a1a2e]/10 to-[#1a1a2e]/20 flex items-center justify-center overflow-hidden shrink-0">
                <span className="text-[4px] text-[#1A1A2E]/50 text-center leading-tight px-0.5 break-all">{sub}</span>
              </div>
            )}
            {row.subMaterials.length > 1 && (
              <button onClick={() => removeSubMaterial(row.id, i)} className="text-red-400 opacity-0 group-hover/sub:opacity-100 shrink-0"><X className="w-2.5 h-2.5" /></button>
            )}
          </div>
        ))}
        <button onClick={() => addSubMaterial(row.id)}
          className="flex items-center gap-0.5 text-[7px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 transition-colors mt-0.5 px-1">
          <Plus className="w-2.5 h-2.5" /><span>追加</span>
        </button>
      </div>
    )},
    { key: "me", label: "モーション\nエフェクト", render: (row) => (
      <div>
        <SmartSelect value={row.motionEffect} options={ME_OPTIONS} topCount={3} onChange={(v) => updateRow(row.id, "motionEffect", v)} placeholder="選択" />
        {row.motionEffect && (
          <div className="flex gap-0.5 mt-1">
            {(["テロップ", "メイン素材", "サブ素材"] as const).map((t) => (
              <button key={t} onClick={() => updateRow(row.id, "motionTarget", row.motionTarget === t ? "" : t)}
                className={`text-[7px] px-1 py-0.5 rounded ${row.motionTarget === t ? "bg-[#9333EA]/10 text-[#9333EA] font-bold" : "text-[#1A1A2E]/25 hover:text-[#1A1A2E]/50"}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    )},
    { key: "se", label: "サウンド\nエフェクト", render: (row) => (
      <SmartSelect value={row.soundEffect} options={SE_OPTIONS} topCount={3} onChange={(v) => updateRow(row.id, "soundEffect", v)} placeholder="選択" />
    )},
  ];

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 py-3 flex items-center gap-3">
          <Link href={`/projects/${projectId}/scripts/script-001`}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#1A1A2E]/30 font-medium mb-0.5">編集概要</p>
            {editingTitle ? (
              <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => { setEditingTitle(false); setTitle(titleDraft); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditingTitle(false); setTitle(titleDraft); } if (e.key === "Escape") { setTitleDraft(title); setEditingTitle(false); } }}
                className="text-lg font-bold text-[#1A1A2E] bg-transparent border-b-2 border-[#9333EA] outline-none w-full" />
            ) : (
              <h1 onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
                className="text-lg font-bold text-[#1A1A2E] cursor-text hover:bg-black/[0.02] rounded px-1 -mx-1 transition-colors truncate">{title}</h1>
            )}
          </div>
          <Link href={`/projects/${projectId}/editing`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9333EA] text-white text-[12px] font-semibold hover:bg-[#7E22CE] transition-colors shrink-0">
            編集へ進む <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full border-0 outline-none cursor-pointer appearance-none ${statusOption.bg} ${statusOption.text}`}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
          </select>
        </div>
        {/* Global settings */}
        <div className="px-6 pb-3 flex items-center gap-5 text-xs text-[#1A1A2E]/40 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5" /><span>BGM:</span>
            <input value={globalBgm} onChange={(e) => setGlobalBgm(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none text-xs font-semibold text-[#1A1A2E] w-[220px] px-0.5" />
          </div>
          <div className="text-[#1A1A2E]/15">|</div>
          <div className="flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /><span>音声:</span>
            <select value={voiceType} onChange={(e) => setVoiceType(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none text-xs font-semibold text-[#1A1A2E] cursor-pointer appearance-none px-0.5">
              <optgroup label="機械音声">
                {VOICE_OPTIONS.filter(o => o.group === "機械音声").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
              <optgroup label="声優">
                {VOICE_OPTIONS.filter(o => o.group === "声優").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="text-[#1A1A2E]/15">|</div>
          <div className="flex items-center gap-1.5">
            <span>フォント:</span>
            <select value={globalFont} onChange={(e) => setGlobalFont(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-black/[0.15] focus:border-[#9333EA]/40 outline-none text-xs font-semibold text-[#1A1A2E] cursor-pointer appearance-none px-0.5">
              {FONT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="text-[#1A1A2E]/15">|</div>
          <span>{rows.length}シーン</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.03] text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] transition-all">
              <Download className="w-3.5 h-3.5" /> 一括ダウンロード
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.03] text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] transition-all">
              <Share2 className="w-3.5 h-3.5" /> イメージ共有
            </button>
          </div>
        </div>
      </div>

      {/* ── Top scrollbar ── */}
      <div ref={topScrollRef} className="shrink-0 overflow-x-auto overflow-y-hidden h-3 bg-[#FAF8F5] border-b border-black/[0.03]"
        onScroll={() => syncScroll("top")}>
        <div style={{ width: totalWidth, height: 1 }} />
      </div>

      {/* ── Main content area (single scroll container for sticky left + sticky top) ── */}
      <div ref={mainScrollRef} className="flex-1 overflow-auto"
        onScroll={() => syncScroll("main")}>
        <div style={{ minWidth: totalWidth }}>

          {/* ── STICKY TOP: Video Images row ── */}
          <div className="flex sticky top-0 z-20 bg-[#FAF8F5] pt-3 pb-2">
            {/* Corner cell: label (sticky left + top) */}
            <div className="sticky left-0 z-30 bg-[#FAF8F5] shrink-0 flex items-end pb-1 px-3"
              style={{ width: labelWidth, minWidth: labelWidth }}>
              <span className="text-[8px] font-bold text-[#1A1A2E]/25 leading-tight">動画<br />イメージ</span>
            </div>
            {/* Video cells */}
            {rows.map((row, idx) => (
              <div key={row.id} className="shrink-0 px-1" style={{ width: cardWidth }}>
                {/* BGM change divider */}
                {row.bgmChange && (
                  <div className="mb-1 flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-0.5">
                    <span className="text-[7px] font-bold text-yellow-700 whitespace-nowrap">♪ ここから:</span>
                    <input value={row.bgmValue} onChange={(e) => updateRow(row.id, "bgmValue", e.target.value)}
                      placeholder="新BGM名" className="flex-1 text-[7px] text-yellow-800 bg-transparent outline-none placeholder:text-yellow-400 min-w-0" />
                  </div>
                )}
                <VideoImagePreview row={row} idx={idx} onUpdate={(f, v) => updateRow(row.id, f, v)} />
                <div className="flex justify-center gap-2 mt-0.5 text-[6px] text-[#1A1A2E]/15">
                  <span>ドラッグ: 移動</span><span>ホイール: サイズ</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── FIELD ROWS (左ラベル固定 + 横スクロール) ── */}
          <div className="bg-white border-y border-black/[0.06]">
            {fieldDefinitions.map((field, fieldIdx, arr) => (
              <div key={field.key} className={`flex ${fieldIdx < arr.length - 1 ? "border-b border-black/[0.04]" : ""}`}>
                {/* Sticky left label */}
                <div className="sticky left-0 z-10 bg-white shrink-0 px-3 py-2 border-r border-black/[0.06] flex items-start"
                  style={{ width: labelWidth, minWidth: labelWidth }}>
                  <span className="text-[11px] font-bold text-[#1A1A2E]/60 tracking-wider whitespace-pre-line leading-tight">{field.label}</span>
                </div>
                {/* Scene cells */}
                {rows.map((row, idx) => (
                  <div key={row.id} className="shrink-0 p-2 border-r border-black/[0.02] last:border-r-0" style={{ width: cardWidth }}>
                    {field.render(row, idx)}
                  </div>
                ))}
              </div>
            ))}
          </div>

        </div>
      </div>
      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
