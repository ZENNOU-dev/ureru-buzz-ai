"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import {
  Play, Pause, Plus, X, ChevronDown, Music, Check, ArrowLeft, ArrowRight, Package,
} from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type EditingScene = {
  id: number;
  section: string;
  text: string;
  telop: string;
  telopSize: number;
  annotation: string;
  annotationPlacement: "左上" | "右下" | "テロップ追加";
  annotationSize: number;
  fontOverride: string;
  bgmChange: boolean;
  bgmValue: string;
  mainMaterial: string;
  mainMaterialStart: string; // "00:03"
  mainMaterialEnd: string;   // "00:07"
  subMaterials: string[];
  subMaterialStarts: string[];
  subMaterialEnds: string[];
  subMaterialSize: number;
  motionEffect: string;
  motionTarget: string; // "テロップ" | "メイン素材" | "サブ素材" | ""
  soundEffect: string;
  comment: string;
};

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

const FONT_OPTIONS = ["ゴシック体", "明朝体", "手書き風", "丸ゴシック", "教科書体", "ポップ体"];
const ME_OPTIONS = ["フェードイン", "スライドイン", "ズーム", "バウンス", "フラッシュ", "シェイク", "回転", "ぼかし→鮮明", "パララックス"];
const SE_OPTIONS = ["キラキラ", "ドン！", "シュッ", "ポップ", "決定音", "衝撃音", "タイプ音", "チャイム", "風切り音"];
const ANNOTATION_PLACEMENTS = ["左上", "右下", "テロップ追加"] as const;

const GRADIENT_COLORS = [
  "from-rose-500/60 to-purple-600/60", "from-pink-500/60 to-rose-500/60",
  "from-purple-500/60 to-indigo-600/60", "from-purple-400/60 to-fuchsia-500/60",
  "from-fuchsia-500/60 to-pink-500/60", "from-amber-500/60 to-orange-600/60",
  "from-amber-400/60 to-yellow-500/60", "from-amber-500/60 to-red-500/60",
  "from-orange-400/60 to-amber-500/60", "from-teal-400/60 to-emerald-500/60",
  "from-emerald-400/60 to-teal-500/60", "from-cyan-400/60 to-blue-500/60",
  "from-indigo-400/60 to-violet-500/60", "from-emerald-500/60 to-cyan-500/60",
  "from-violet-400/60 to-purple-500/60", "from-pink-400/60 to-rose-500/60",
  "from-rose-400/60 to-red-500/60",
];

// ─── ID generator ────────────────────────────────────
let _nextId = 300;
function nextId() { return _nextId++; }

// ─── Sample Data ─────────────────────────────────────
function makeInitialScenes(): EditingScene[] {
  const data = [
    { section: "フック1", text: "未経験なら\nAIフリーランス\nめちゃチャンスです🥺", annotation: "全体に常時表示\n※個人の感想であり効果を保証するものではありません" },
    { section: "フック2", text: "AIのおかげで\n収入変わりすぎて\n正直びっくり🤩", annotation: "" },
    { section: "フック3", text: "給料・職場環境\n変わらない\n会社員辞めて", annotation: "" },
    { section: "フック3", text: "AIフリーランスに\n転身したら・・・", annotation: "" },
    { section: "フック3", text: "バブルすぎて\nびっくりしてます😭", annotation: "" },
    { section: "商品紹介", text: "私は\nAIとXを使って\n会社員時代の月収を上回る\nフリーランス", annotation: "" },
    { section: "商品紹介", text: "初めは\nAI使わなきゃな〜\nって", annotation: "" },
    { section: "商品紹介", text: "チャッピー愛用\nしてたけど", annotation: "" },
    { section: "商品紹介", text: "仕事で使えなくて挫折", annotation: "" },
    { section: "商品紹介", text: "そんな時に\n出会ったのが", annotation: "" },
    { section: "商品紹介", text: "SNS投稿用\nオリジナルAIを\n使わせてもらえる", annotation: "" },
    { section: "商品紹介", text: "AI時代の\nフリーランススクール\nDOT-AI BOOTCAMP", annotation: "" },
    { section: "権威性", text: "マーケで成功してる\n連続起業家\n発案だから", annotation: "" },
    { section: "ベネフィット", text: "SNS投稿を\n半自動で作れる\nツールのおかげで", annotation: "" },
    { section: "ベネフィット", text: "アイデア出しと\n調整だけで\n万バズいっぱい✌️", annotation: "" },
    { section: "CTA", text: "AIで仕事の効率\n上がったおかげで", annotation: "" },
    { section: "CTA", text: "3ヶ月で\n会社員時代の\n収入額更新✨", annotation: "" },
  ];

  return data.map((d) => ({
    id: nextId(),
    section: d.section,
    text: d.text,
    telop: d.text,
    telopSize: 12,
    annotation: d.annotation,
    annotationPlacement: "左上" as const,
    annotationSize: 6,
    fontOverride: "",
    bgmChange: false,
    bgmValue: "",
    mainMaterial: "",
    mainMaterialStart: "00:00",
    mainMaterialEnd: "00:02",
    subMaterials: [""],
    subMaterialStarts: ["00:00"],
    subMaterialEnds: ["00:02"],
    subMaterialSize: 50,
    motionEffect: "",
    motionTarget: "",
    soundEffect: "",
    comment: "",
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

// ─── Smart Select ────────────────────────────────────
function SmartSelect({ value, options, topCount = 3, onChange, placeholder }: {
  value: string; options: string[]; topCount?: number; onChange: (v: string) => void; placeholder?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const topOptions = options.slice(0, topCount);
  const restOptions = options.slice(topCount);
  const isInRest = restOptions.includes(value);

  if (showAll) {
    return (
      <select value={value} onChange={(e) => { onChange(e.target.value); setShowAll(false); }}
        onBlur={() => setShowAll(false)} autoFocus
        className="w-full bg-transparent border border-[#9333EA]/30 rounded-lg px-1.5 py-1 outline-none text-[10px] text-[#1A1A2E]/70 cursor-pointer">
        <option value="">{placeholder ?? "選択してください"}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
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

// ─── Bubble item helper ──────────────────────────────
function Bubble({ label, text, color = "bg-[#FAF8F5]" }: { label: string; text: string; color?: string }) {
  return (
    <div className={`${color} w-full aspect-square rounded-full inline-flex flex-col items-center justify-center p-1.5 shrink-0 shadow-sm max-w-[72px]`}>
      <span className="text-[6px] font-bold text-[#1A1A2E]/50 uppercase">{label}</span>
      <p className="text-[6px] text-[#1A1A2E] font-medium leading-tight text-center mt-0.5 line-clamp-3">{text}</p>
    </div>
  );
}

// ─── Concept + Plan cards (正方形バブル型) ─────────────
function ConceptPlanCards() {
  return (
    <div className="grid grid-cols-2 gap-2" style={{ gridTemplateRows: "1fr" }}>
      {/* コンセプト */}
      <div className="bg-white/90 rounded-xl border border-black/[0.06] p-3 flex flex-col" style={{ aspectRatio: "1/1" }}>
        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider">コンセプト</span>
        <p className="text-[9px] font-bold text-[#1A1A2E] mt-0.5 mb-1 leading-snug line-clamp-2">AIとSNSを組み合わせた新世代フリーランス</p>
        <div className="grid grid-cols-2 gap-1.5 flex-1 place-items-center">
          <Bubble label="WHO" text="会社員で給料に不満を持つ20〜30代" color="bg-emerald-50" />
          <Bubble label="WHAT" text="AI活用フリーランスで収入UP" color="bg-emerald-50" />
          <Bubble label="WHY" text="AIスキル×SNS運用で短期成果" color="bg-emerald-50" />
          <Bubble label="USP" text="実践AIツール+連続起業家監修" color="bg-emerald-50" />
        </div>
      </div>
      {/* 広告企画 */}
      <div className="bg-white/90 rounded-xl border border-black/[0.06] p-3 flex flex-col" style={{ aspectRatio: "1/1" }}>
        <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wider">広告企画</span>
        <p className="text-[9px] font-bold text-[#1A1A2E] mt-0.5 mb-1 leading-snug line-clamp-2">フリーランス2.0体験談</p>
        <div className="grid grid-cols-2 gap-1.5 flex-1 place-items-center">
          <Bubble label="興味の型" text="体験談 / ビフォーアフター" color="bg-amber-50" />
          <Bubble label="構成の型" text="フック→共感→商品紹介→CTA" color="bg-amber-50" />
          <Bubble label="FV" text="未経験ならAIフリーランス" color="bg-amber-50" />
          <Bubble label="話者設定" text="ずんだもん（機械音声）" color="bg-amber-50" />
        </div>
      </div>
    </div>
  );
}

// ─── Phone Preview (draggable telop + annotation) ────
function PhonePreview({ scene, idx, total, playing, onTogglePlay, onUpdate, editMode = false }: {
  scene: EditingScene; idx: number; total: number; playing: boolean; onTogglePlay: () => void;
  onUpdate: (field: string, value: any) => void; editMode?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<"telop" | "annotation" | null>(null);
  const [telopPos, setTelopPos] = useState({ x: 50, y: 55 });
  const [annoPos, setAnnoPos] = useState({ x: 15, y: 12 });

  const sc = SECTION_COLORS[scene.section] || SECTION_COLORS[""];
  const telopLines = scene.telop.split("\n").filter((l) => l.trim());
  const gradientIdx = idx % GRADIENT_COLORS.length;
  const currentSec = idx * 2;
  const totalSec = total * 2;

  const handlePointerDown = useCallback((target: "telop" | "annotation") => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragTarget(target);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragTarget || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    if (dragTarget === "telop") setTelopPos({ x, y });
    else setAnnoPos({ x, y });
  }, [dragTarget]);

  const handlePointerUp = useCallback(() => setDragTarget(null), []);

  // Wheel to resize telop/annotation/subMaterial
  const handleWheel = useCallback((target: "telopSize" | "annotationSize" | "subMaterialSize", current: number, min: number, max: number) => (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    onUpdate(target, Math.max(min, Math.min(max, current + delta)));
  }, [onUpdate]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Time display */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-[#1A1A2E]/40">
        <span>{String(Math.floor(currentSec / 60)).padStart(2, "0")}:{String(currentSec % 60).padStart(2, "0")}</span>
        <span>/</span>
        <span>{String(Math.floor(totalSec / 60)).padStart(2, "0")}:{String(totalSec % 60).padStart(2, "0")}</span>
      </div>

      {/* Phone frame */}
      <div ref={frameRef}
        className="w-[220px] aspect-[9/16] rounded-[24px] border-[3px] border-[#1A1A2E]/15 bg-[#0a0a0a] relative overflow-hidden flex flex-col shadow-xl select-none"
        onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <div className="w-[40px] h-[5px] bg-white/15 rounded-full mx-auto mt-[6px] shrink-0 z-10" />
        <div className="flex-1 mx-[3px] mb-[5px] mt-[3px] rounded-[10px] relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT_COLORS[gradientIdx]}`} />
          <div className="absolute inset-0 bg-[#1a1a2e]/30" />

          {/* Scene badge */}
          <div className="absolute top-2.5 left-0 right-0 z-[15] flex items-center justify-center gap-1 pointer-events-none">
            <span className="text-[8px] font-bold text-white/50">{String(idx + 1).padStart(2, "0")}</span>
            {scene.section && (
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${sc.badgeBg} ${sc.text}`}>{scene.section}</span>
            )}
          </div>

          {/* Draggable Annotation (shows actual content, clipped to screen) */}
          {scene.annotation && (
            <div
              className={`absolute z-[8] cursor-grab active:cursor-grabbing ${dragTarget === "annotation" ? "opacity-70" : ""}`}
              style={{ left: `${Math.max(10, Math.min(90, annoPos.x))}%`, top: `${Math.max(10, Math.min(90, annoPos.y))}%`, transform: "translate(-50%, -50%)", maxWidth: "85%", maxHeight: "40%" }}
              onPointerDown={handlePointerDown("annotation")}
              onWheel={handleWheel("annotationSize", scene.annotationSize, 4, 12)}
            >
              <div className="border border-white/50 bg-black/40 rounded-sm px-1.5 py-0.5 text-white/80 whitespace-pre-line leading-snug overflow-hidden"
                style={{ fontSize: `${scene.annotationSize}px`, maxHeight: "100%" }}>
                {scene.annotation}
              </div>
            </div>
          )}

          {/* Draggable Telop (wheel to resize) */}
          {telopLines.length > 0 && (
            <div
              className={`absolute z-10 cursor-grab active:cursor-grabbing ${dragTarget === "telop" ? "opacity-70" : ""}`}
              style={{ left: `${telopPos.x}%`, top: `${telopPos.y}%`, transform: "translate(-50%, -50%)", maxWidth: "92%" }}
              onPointerDown={handlePointerDown("telop")}
              onWheel={handleWheel("telopSize", scene.telopSize, 6, 20)}
            >
              <div className="text-center">
                {telopLines.map((line, i) => (
                  <div key={i} className="text-white font-bold leading-tight"
                    style={{ fontSize: `${scene.telopSize}px`, textShadow: "0 0 5px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)" }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub material overlay (resizable via wheel) */}
          {scene.subMaterials[0] && (
            <div className="absolute bottom-12 right-2 z-[6]"
              onWheel={handleWheel("subMaterialSize", scene.subMaterialSize, 20, 80)}>
              <div className="bg-black/20 border border-white/20 rounded overflow-hidden"
                style={{ width: `${scene.subMaterialSize}%` }}>
                <div className="aspect-[9/16] bg-gradient-to-b from-white/10 to-white/5 flex items-center justify-center">
                  <span className="text-[5px] text-white/50 text-center px-1">{scene.subMaterials[0]}</span>
                </div>
              </div>
            </div>
          )}

          {/* Main material label */}
          {scene.mainMaterial && (
            <div className="absolute bottom-8 left-2 right-2 z-[5]">
              <div className="text-[6px] text-white/50 bg-black/30 rounded px-1.5 py-0.5 text-center truncate">素材: {scene.mainMaterial}</div>
            </div>
          )}

          {/* Play/Pause overlay (hidden in edit mode) */}
          {!editMode && (
            <button onClick={onTogglePlay} className="absolute inset-0 z-20 flex items-center justify-center group">
              <div className={`w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity ${playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
              </div>
            </button>
          )}

          {/* Progress */}
          <div className="absolute bottom-0 left-0 right-0 z-[18] h-1 bg-white/10">
            <div className="h-full bg-[#9333EA]/80 transition-all duration-500" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
        </div>
        <div className="w-[30px] h-[4px] bg-white/15 rounded-full mx-auto mb-[5px] shrink-0" />
      </div>

      {/* Play controls (hidden in edit mode) */}
      {!editMode ? (
        <div className="flex items-center gap-3">
          <button onClick={onTogglePlay}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playing ? "bg-red-500 hover:bg-red-600" : "bg-[#9333EA] hover:bg-[#7E22CE]"}`}>
            {playing ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
          </button>
          <span className="text-[10px] text-[#1A1A2E]/40 font-medium">
            {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-[#1A1A2E]/40 font-medium">
            {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} — 編集中
          </span>
          {/* Size controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[8px] text-[#1A1A2E]/40">
              <span>テロップ</span>
              <button onClick={() => onUpdate("telopSize", Math.max(6, scene.telopSize - 1))} className="w-5 h-5 rounded bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[10px] font-bold">−</button>
              <span className="text-[9px] font-mono w-4 text-center">{scene.telopSize}</span>
              <button onClick={() => onUpdate("telopSize", Math.min(20, scene.telopSize + 1))} className="w-5 h-5 rounded bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[10px] font-bold">+</button>
            </div>
            <div className="w-[1px] h-3 bg-black/[0.06]" />
            <div className="flex items-center gap-1 text-[8px] text-[#1A1A2E]/40">
              <span>注釈</span>
              <button onClick={() => onUpdate("annotationSize", Math.max(4, scene.annotationSize - 1))} className="w-5 h-5 rounded bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[10px] font-bold">−</button>
              <span className="text-[9px] font-mono w-4 text-center">{scene.annotationSize}</span>
              <button onClick={() => onUpdate("annotationSize", Math.min(12, scene.annotationSize + 1))} className="w-5 h-5 rounded bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[10px] font-bold">+</button>
            </div>
          </div>
          <p className="text-[7px] text-[#1A1A2E]/15">ドラッグで位置調整</p>
        </div>
      )}
    </div>
  );
}

// ─── Field Definitions for horizontal layout ─────────
function getFieldDefs(
  scenes: EditingScene[],
  globalBgm: string,
  updateScene: (id: number, field: string, value: any) => void,
  addSub: (id: number) => void,
  removeSub: (id: number, i: number) => void,
  updateSub: (id: number, i: number, v: string) => void,
) {
  const getEffBgm = (idx: number) => {
    let eff = globalBgm;
    for (let i = 0; i <= idx; i++) {
      if (scenes[i].bgmChange && scenes[i].bgmValue) eff = scenes[i].bgmValue;
    }
    return eff;
  };

  return [
    { key: "text", label: "ナレーション", render: (s: EditingScene) => <AutoTextarea value={s.text} readOnly className="text-[10px]" /> },
    { key: "telop", label: "テロップ", render: (s: EditingScene) => <AutoTextarea value={s.telop} onChange={(v) => updateScene(s.id, "telop", v)} placeholder="テロップ" className="text-[10px]" /> },
    { key: "annotation", label: "注釈", render: (s: EditingScene) => (
      <div>
        {s.annotation ? (
          <div className="flex gap-0.5 mb-1">
            {ANNOTATION_PLACEMENTS.map((p) => (
              <button key={p} onClick={() => updateScene(s.id, "annotationPlacement", p)}
                className={`text-[7px] px-1 py-0.5 rounded ${s.annotationPlacement === p ? "bg-[#9333EA]/10 text-[#9333EA] font-bold" : "text-[#1A1A2E]/25 hover:text-[#1A1A2E]/50"}`}>
                {p}
              </button>
            ))}
          </div>
        ) : null}
        <AutoTextarea value={s.annotation} onChange={(v) => updateScene(s.id, "annotation", v)} placeholder="注釈" className="text-[10px]" />
      </div>
    )},
    { key: "font", label: "フォント\n※変更時", render: (s: EditingScene) => <SmartSelect value={s.fontOverride} options={FONT_OPTIONS} topCount={3} onChange={(v) => updateScene(s.id, "fontOverride", v)} placeholder="変更なし" /> },
    { key: "bgm", label: "BGM", render: (s: EditingScene, idx: number) => {
      const eff = getEffBgm(idx);
      // Is this the start of a BGM segment? (first scene, or this scene has bgmChange)
      const isSegmentStart = idx === 0 || s.bgmChange;
      // Count how many consecutive scenes share this BGM
      let segLen = 0;
      if (isSegmentStart) {
        for (let j = idx; j < scenes.length; j++) {
          if (j > idx && scenes[j].bgmChange) break;
          segLen++;
        }
      }
      return (
        <div>
          {isSegmentStart ? (
            <div className="bg-yellow-50/50 border border-yellow-200/50 rounded-lg px-2 py-1">
              <div className="text-[8px] font-bold text-yellow-700 truncate">♪ {eff}</div>
              <div className="text-[7px] text-yellow-600/50 mt-0.5">{segLen}シーン連続</div>
            </div>
          ) : (
            <div className="flex items-center h-full">
              <div className="w-full h-[2px] bg-yellow-200/60 rounded" />
            </div>
          )}
          <button onClick={() => updateScene(s.id, "bgmChange", !s.bgmChange)}
            className={`text-[8px] px-2 py-0.5 rounded border transition-all w-full text-left mt-1 ${s.bgmChange ? "bg-yellow-50 border-yellow-300 text-yellow-700 font-semibold" : "border-transparent text-[#1A1A2E]/20 hover:border-[#1A1A2E]/10 hover:text-[#1A1A2E]/40"}`}>
            {s.bgmChange ? "♪ ここからBGM変更中" : "BGM変更"}
          </button>
          {s.bgmChange && (
            <input value={s.bgmValue} onChange={(e) => updateScene(s.id, "bgmValue", e.target.value)}
              placeholder="新BGM名" className="w-full text-[8px] text-yellow-800 bg-yellow-50/50 border border-yellow-200 rounded px-1.5 py-0.5 outline-none placeholder:text-yellow-400 mt-0.5" />
          )}
        </div>
      );
    }},
    { key: "mainMat", label: "メイン\n素材名", render: (s: EditingScene) => (
      <div className="flex flex-col items-center gap-1">
        <div className="w-[50px] aspect-[9/16] rounded-[4px] border border-black/[0.08] bg-gradient-to-b from-[#1a1a2e]/10 to-[#1a1a2e]/20 flex items-center justify-center overflow-hidden">
          <span className="text-[5px] text-[#1A1A2E]/30 text-center px-0.5">{s.mainMaterial || "メイン素材"}</span>
        </div>
        <input value={s.mainMaterial} onChange={(e) => updateScene(s.id, "mainMaterial", e.target.value)}
          placeholder="素材名を入力" className="w-full text-[10px] text-[#1A1A2E]/70 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2 py-1 outline-none placeholder:text-[#1A1A2E]/20 text-center" />
        <div className="flex items-center gap-0.5 text-[8px] text-[#1A1A2E]/40">
          <input value={s.mainMaterialStart} onChange={(e) => updateScene(s.id, "mainMaterialStart", e.target.value)}
            className="w-[38px] text-center bg-transparent border border-black/[0.06] rounded px-0.5 py-0.5 outline-none focus:border-[#9333EA]/40 text-[8px]" />
          <span>〜</span>
          <input value={s.mainMaterialEnd} onChange={(e) => updateScene(s.id, "mainMaterialEnd", e.target.value)}
            className="w-[38px] text-center bg-transparent border border-black/[0.06] rounded px-0.5 py-0.5 outline-none focus:border-[#9333EA]/40 text-[8px]" />
        </div>
      </div>
    )},
    { key: "subMat", label: "サブ\n素材名", render: (s: EditingScene) => (
      <div>
        {s.subMaterials.map((sub, i) => (
          <div key={i} className="group/sub flex flex-col items-center gap-0.5 mb-1">
            <div className="flex items-center gap-0.5 w-full">
              <input value={sub} onChange={(e) => updateSub(s.id, i, e.target.value)}
                placeholder="サブ素材" className="w-full text-[10px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2 py-0.5 outline-none placeholder:text-[#1A1A2E]/15 text-center" />
              {s.subMaterials.length > 1 && (
                <button onClick={() => removeSub(s.id, i)} className="text-red-400 opacity-0 group-hover/sub:opacity-100 shrink-0"><X className="w-2.5 h-2.5" /></button>
              )}
            </div>
            <div className="flex items-center gap-0.5 text-[7px] text-[#1A1A2E]/30">
              <input value={s.subMaterialStarts?.[i] || "00:00"} onChange={(e) => {
                const starts = [...(s.subMaterialStarts || s.subMaterials.map(() => "00:00"))]; starts[i] = e.target.value;
                updateScene(s.id, "subMaterialStarts", starts);
              }}
                className="w-[34px] text-center bg-transparent border border-black/[0.06] rounded px-0.5 py-0.5 outline-none focus:border-[#9333EA]/40 text-[7px]" />
              <span>〜</span>
              <input value={s.subMaterialEnds?.[i] || "00:02"} onChange={(e) => {
                const ends = [...(s.subMaterialEnds || s.subMaterials.map(() => "00:02"))]; ends[i] = e.target.value;
                updateScene(s.id, "subMaterialEnds", ends);
              }}
                className="w-[34px] text-center bg-transparent border border-black/[0.06] rounded px-0.5 py-0.5 outline-none focus:border-[#9333EA]/40 text-[7px]" />
            </div>
          </div>
        ))}
        <button onClick={() => addSub(s.id)}
          className="flex items-center gap-0.5 text-[7px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 transition-colors mt-0.5 px-1">
          <Plus className="w-2.5 h-2.5" /><span>追加</span>
        </button>
      </div>
    )},
    { key: "me", label: "モーション\nエフェクト", render: (s: EditingScene) => (
      <div>
        <SmartSelect value={s.motionEffect} options={ME_OPTIONS} topCount={3} onChange={(v) => updateScene(s.id, "motionEffect", v)} placeholder="選択" />
        {s.motionEffect && (
          <div className="mt-1">
            <span className="text-[7px] text-[#1A1A2E]/30 block mb-0.5">対象:</span>
            <div className="flex flex-wrap gap-0.5">
              {["テロップ", "メイン素材", "サブ素材"].map((t) => (
                <button key={t} onClick={() => updateScene(s.id, "motionTarget", s.motionTarget === t ? "" : t)}
                  className={`text-[7px] px-1.5 py-0.5 rounded transition-colors ${s.motionTarget === t ? "bg-[#9333EA]/10 text-[#9333EA] font-bold" : "bg-black/[0.03] text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )},
    { key: "se", label: "サウンド\nエフェクト", render: (s: EditingScene) => <SmartSelect value={s.soundEffect} options={SE_OPTIONS} topCount={3} onChange={(v) => updateScene(s.id, "soundEffect", v)} placeholder="選択" /> },
  ] as { key: string; label: string; render: (s: EditingScene, idx: number) => React.ReactNode }[];
}

// ─── Main Page ────────────────────────────────────────
export default function EditingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [scenes, setScenes] = useState<EditingScene[]>(makeInitialScenes);
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [phoneMode, setPhoneMode] = useState<"preview" | "edit">("preview");
  const [globalBgm] = useState("BGM-01: アップテンポ・ポジティブ");
  const [globalFont] = useState("ゴシック体");
  const [globalFeedback, setGlobalFeedback] = useState("");

  const editScrollRef = useRef<HTMLDivElement | null>(null);
  const activeSceneIdRef = useRef<number | null>(null);

  // Scene update callbacks
  const updateScene = useCallback((sceneId: number, field: string, value: any) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s)));
  }, []);
  const addSubMaterial = useCallback((sceneId: number) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? { ...s, subMaterials: [...s.subMaterials, ""] } : s));
  }, []);
  const removeSubMaterial = useCallback((sceneId: number, idx: number) => {
    setScenes((prev) => prev.map((s) => {
      if (s.id !== sceneId) return s;
      const sm = s.subMaterials.filter((_, i) => i !== idx);
      return { ...s, subMaterials: sm.length > 0 ? sm : [""] };
    }));
  }, []);
  const updateSubMaterial = useCallback((sceneId: number, idx: number, v: string) => {
    setScenes((prev) => prev.map((s) => {
      if (s.id !== sceneId) return s;
      const sm = [...s.subMaterials]; sm[idx] = v;
      return { ...s, subMaterials: sm };
    }));
  }, []);

  // Auto-play: cycle through scenes every 2 seconds
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => {
        const next = prev + 1;
        if (next >= scenes.length) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, scenes.length]);

  // Auto-scroll edit area to keep active scene visible (centered)
  useEffect(() => {
    if (!editScrollRef.current) return;
    const lw = 100;
    const cw = 220;
    const containerWidth = editScrollRef.current.clientWidth;
    const sceneCenter = lw + activeIdx * cw + cw / 2;
    const scrollTo = Math.max(0, sceneCenter - containerWidth / 2);
    editScrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
  }, [activeIdx]);

  // Update active scene ref for voice input
  useEffect(() => {
    activeSceneIdRef.current = scenes[activeIdx]?.id ?? null;
  }, [activeIdx, scenes]);

  // Voice handlers
  const handleVoiceTranscript = useCallback((text: string) => {
    const targetId = activeSceneIdRef.current ?? scenes[activeIdx]?.id;
    if (!targetId) return;
    setScenes((prev) => prev.map((s) => {
      if (s.id !== targetId) return s;
      return { ...s, telop: s.telop ? s.telop + "\n" + text : text };
    }));
  }, [scenes, activeIdx]);

  const handleVoiceFeedback = useCallback((text: string) => {
    setGlobalFeedback((prev) => prev ? prev + "\n" + text : text);
  }, []);

  const activeScene = scenes[activeIdx];
  const labelWidth = 100;
  const cardWidth = 220;
  const totalWidth = labelWidth + scenes.length * cardWidth + 32;

  const fieldDefs = getFieldDefs(scenes, globalBgm, updateScene, addSubMaterial, removeSubMaterial, updateSubMaterial);

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-5 py-2.5 flex items-center gap-3">
          <Link href={`/projects/${projectId}/edit-brief`}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA] shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#1A1A2E]/30 font-medium">編集</p>
            <h1 className="text-base font-bold text-[#1A1A2E] truncate">フリーランス2.0体験談</h1>
          </div>
          <Link href={`/projects/${projectId}/regulations`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/[0.03] text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] transition-all">
            <Check className="w-3.5 h-3.5" /> クライアントチェック
          </Link>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9333EA] text-white text-[12px] font-semibold hover:bg-[#7E22CE] transition-colors shadow-sm">
            <Package className="w-3.5 h-3.5" /> 納品
          </button>
        </div>
      </div>

      {/* ── Main: Preview (left) + Edit Grid (right) ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left: Concept/Plan cards + Phone Preview */}
        <div className="w-[38%] min-w-[300px] max-w-[420px] shrink-0 flex flex-col border-r border-black/[0.06] bg-[#F5F3F0]">
          {/* Concept + Plan cards above phone */}
          <div className="shrink-0 px-3 pt-3">
            <ConceptPlanCards />
          </div>
          {/* Phone centered (with mode tabs above time) */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-3">
            {/* Preview/Edit tabs above time */}
            <div className="flex items-center gap-1 mb-1">
              <button onClick={() => setPhoneMode("preview")}
                className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full transition-all ${phoneMode === "preview" ? "bg-[#9333EA] text-white" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
                ▶ プレビュー
              </button>
              <button onClick={() => { setPhoneMode("edit"); setPlaying(false); }}
                className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full transition-all ${phoneMode === "edit" ? "bg-[#9333EA] text-white" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50"}`}>
                ✏️ 編集
              </button>
            </div>
            {activeScene && (
              <PhonePreview
                scene={activeScene}
                idx={activeIdx}
                total={scenes.length}
                playing={playing && phoneMode === "preview"}
                onTogglePlay={() => { if (phoneMode === "preview") setPlaying(!playing); }}
                onUpdate={(f, v) => updateScene(activeScene.id, f, v)}
                editMode={phoneMode === "edit"}
              />
            )}
            {phoneMode === "edit" && (
              <p className="text-[7px] text-[#1A1A2E]/20 mt-1 text-center">
                スマホ内でドラッグ: 位置調整 / ホイール: サイズ変更<br />右の編集画面でもテキスト変更可能（双方向同期）
              </p>
            )}
          </div>
        </div>

        {/* Right: Horizontal edit grid (edit-brief style) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div ref={editScrollRef} className="flex-1 overflow-auto">
            <div style={{ minWidth: totalWidth }}>

              {/* BGM + フォント（編集概要と同じ連結型） */}
              <div className="flex items-center gap-4 px-3 py-1.5 bg-white/80 border-b border-black/[0.04]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-[#1A1A2E]/40">♪ BGM</span>
                  <div className="h-[1px] w-6 bg-[#1A1A2E]/15" />
                  <span className="text-[10px] font-semibold text-[#1A1A2E]/70">{globalBgm}</span>
                </div>
                <div className="h-3 w-[1px] bg-[#1A1A2E]/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-[#1A1A2E]/40">Aa フォント</span>
                  <div className="h-[1px] w-6 bg-[#1A1A2E]/15" />
                  <span className="text-[10px] font-semibold text-[#1A1A2E]/70">{globalFont}</span>
                </div>
              </div>

              {/* Sticky top: scene headers with highlight */}
              <div className="flex sticky top-0 z-20 bg-[#FAF8F5] pt-2 pb-1 border-b border-black/[0.04]">
                <div className="sticky left-0 z-30 bg-[#FAF8F5] shrink-0 px-3 flex items-center"
                  style={{ width: labelWidth, minWidth: labelWidth }}>
                  <span className="text-[11px] font-bold text-[#1A1A2E]/60">シーン</span>
                </div>
                {scenes.map((s, idx) => {
                  const sc = SECTION_COLORS[s.section] || SECTION_COLORS[""];
                  const isActive = idx === activeIdx;
                  return (
                    <button key={s.id} onClick={() => { setActiveIdx(idx); setPlaying(false); }}
                      className={`shrink-0 px-1 py-1 flex flex-col items-center gap-0.5 rounded-lg transition-all ${isActive ? "bg-[#9333EA]/5 ring-2 ring-[#9333EA]/30" : "hover:bg-black/[0.02]"}`}
                      style={{ width: cardWidth }}>
                      <span className={`text-[9px] font-bold ${isActive ? "text-[#9333EA]" : "text-[#1A1A2E]/30"}`}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      {s.section && (
                        <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${sc.badgeBg} ${sc.text}`}>{s.section}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Field rows */}
              <div className="bg-white border-y border-black/[0.06]">
                {fieldDefs.map((field, fieldIdx, arr) => (
                  <div key={field.key} className={`flex ${fieldIdx < arr.length - 1 ? "border-b border-black/[0.04]" : ""}`}>
                    <div className="sticky left-0 z-10 bg-white shrink-0 px-3 py-2 border-r border-black/[0.06] flex items-start"
                      style={{ width: labelWidth, minWidth: labelWidth }}>
                      <span className="text-[11px] font-bold text-[#1A1A2E]/60 tracking-wider whitespace-pre-line leading-tight">{field.label}</span>
                    </div>
                    {scenes.map((s, idx) => {
                      const isActive = idx === activeIdx;
                      return (
                        <div key={s.id}
                          className={`shrink-0 p-2 border-r border-black/[0.02] last:border-r-0 transition-colors text-center ${isActive ? "bg-[#9333EA]/[0.02]" : ""}`}
                          style={{ width: cardWidth }}>
                          {field.render(s, idx)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Bottom padding */}
              <div className="h-4" />
            </div>
          </div>
        </div>

      </div>

      {/* Voice Input */}
      <VoiceInputButton onTranscript={handleVoiceTranscript} onFeedback={handleVoiceFeedback} />
    </div>
  );
}
