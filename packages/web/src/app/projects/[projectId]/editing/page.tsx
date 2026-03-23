"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import {
  Play, Pause, Plus, X, ChevronDown, Music, Check,
} from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type EditingScene = {
  id: number;
  section: string;
  text: string;
  telop: string;
  annotation: string;
  annotationPlacement: "左上" | "右下" | "テロップ追加";
  fontOverride: string;
  bgmChange: boolean;
  bgmValue: string;
  mainMaterial: string;
  subMaterials: string[];
  motionEffect: string;
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
  "from-rose-500/60 to-purple-600/60",
  "from-pink-500/60 to-rose-500/60",
  "from-purple-500/60 to-indigo-600/60",
  "from-purple-400/60 to-fuchsia-500/60",
  "from-fuchsia-500/60 to-pink-500/60",
  "from-amber-500/60 to-orange-600/60",
  "from-amber-400/60 to-yellow-500/60",
  "from-amber-500/60 to-red-500/60",
  "from-orange-400/60 to-amber-500/60",
  "from-teal-400/60 to-emerald-500/60",
  "from-emerald-400/60 to-teal-500/60",
  "from-cyan-400/60 to-blue-500/60",
  "from-indigo-400/60 to-violet-500/60",
  "from-emerald-500/60 to-cyan-500/60",
  "from-violet-400/60 to-purple-500/60",
  "from-pink-400/60 to-rose-500/60",
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
    annotation: d.annotation,
    annotationPlacement: "左上" as const,
    fontOverride: "",
    bgmChange: false,
    bgmValue: "",
    mainMaterial: "",
    subMaterials: [""],
    motionEffect: "",
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
      className={`w-full bg-transparent border border-transparent ${readOnly ? "" : "hover:border-black/[0.08] focus:border-[#9333EA]/40 hover:bg-black/[0.01]"} rounded-lg px-2.5 py-1.5 outline-none resize-none overflow-hidden text-[12px] leading-relaxed text-[#1A1A2E]/80 placeholder:text-[#1A1A2E]/20 ${readOnly ? "text-[#1A1A2E]/50 cursor-default" : ""} ${className ?? ""}`}
      style={{ minHeight: "28px" }}
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
      <select value={value} onChange={(e) => { onChange(e.target.value); setShowAll(false); }}
        onBlur={() => setShowAll(false)} autoFocus
        className="w-full bg-transparent border border-[#9333EA]/30 rounded-lg px-2 py-1.5 outline-none text-[11px] text-[#1A1A2E]/70 cursor-pointer">
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
      className="w-full bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2 py-1.5 outline-none text-[11px] text-[#1A1A2E]/70 cursor-pointer appearance-none">
      <option value="">{placeholder ?? "—"}</option>
      {topOptions.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__other__">{isInRest ? `その他: ${value}` : "その他..."}</option>
    </select>
  );
}

// ─── Field Label ─────────────────────────────────────
function FieldLabel({ label }: { label: string }) {
  return (
    <div className="mb-1">
      <span className="text-[11px] font-bold text-[#1A1A2E]/50 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Concept + Plan Cards (top) ──────────────────────
function TopCards() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="shrink-0 bg-white border-b border-black/[0.06]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-2.5 flex items-center gap-2 text-left hover:bg-black/[0.01] transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 text-[#1A1A2E]/30 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        <span className="text-[11px] font-bold text-[#1A1A2E]/40">コンセプト・広告企画</span>
      </button>
      {!collapsed && (
        <div className="px-5 pb-3 flex gap-3 overflow-x-auto">
          {/* コンセプト */}
          <div className="shrink-0 bg-[#FAF8F5] rounded-xl border border-black/[0.06] p-3 min-w-[200px]">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">コンセプト</span>
            <p className="text-[13px] font-bold text-[#1A1A2E] mt-1 leading-snug">AIとSNSを組み合わせた新世代フリーランス</p>
          </div>
          {/* 広告企画 */}
          <div className="shrink-0 bg-[#FAF8F5] rounded-xl border border-black/[0.06] p-3 min-w-[320px]">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">広告企画</span>
            <p className="text-[13px] font-bold text-[#1A1A2E] mt-1 leading-snug">フリーランス2.0体験談</p>
            <div className="flex gap-3 mt-2">
              <div>
                <span className="text-[9px] text-[#1A1A2E]/30 font-bold">興味の型</span>
                <p className="text-[10px] text-[#1A1A2E]/70 leading-snug">体験談 / ビフォーアフター</p>
              </div>
              <div>
                <span className="text-[9px] text-[#1A1A2E]/30 font-bold">構成の型</span>
                <p className="text-[10px] text-[#1A1A2E]/70 leading-snug whitespace-pre-line">{"フック→共感→コンセプト→\n商品紹介→ベネフィット→CTA"}</p>
              </div>
              <div>
                <span className="text-[9px] text-[#1A1A2E]/30 font-bold">FV</span>
                <p className="text-[10px] text-[#1A1A2E]/70 leading-snug whitespace-pre-line">{"未経験なら\nAIフリーランス\nめちゃチャンスです"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phone Preview ───────────────────────────────────
function PhonePreview({ scene, idx, total }: { scene: EditingScene; idx: number; total: number }) {
  const [playing, setPlaying] = useState(false);
  const sc = SECTION_COLORS[scene.section] || SECTION_COLORS[""];
  const telopLines = scene.telop.split("\n").filter((l) => l.trim());
  const gradientIdx = idx % GRADIENT_COLORS.length;

  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="w-[280px] aspect-[9/16] rounded-[28px] border-[3px] border-[#1A1A2E]/15 bg-[#0a0a0a] relative overflow-hidden flex flex-col shadow-xl">
        {/* Notch */}
        <div className="w-[50px] h-[6px] bg-white/15 rounded-full mx-auto mt-[8px] shrink-0 z-10" />

        {/* Screen */}
        <div className="flex-1 mx-[4px] mb-[6px] mt-[4px] rounded-[12px] relative overflow-hidden">
          {/* Background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT_COLORS[gradientIdx]}`} />
          <div className="absolute inset-0 bg-[#1a1a2e]/30" />

          {/* Scene number + section badge at top center */}
          <div className="absolute top-3 left-0 right-0 z-[15] flex items-center justify-center gap-1.5">
            <span className="text-[10px] font-bold text-white/50">{String(idx + 1).padStart(2, "0")}</span>
            {scene.section && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sc.badgeBg} ${sc.text}`}>{scene.section}</span>
            )}
          </div>

          {/* Annotation box */}
          {scene.annotation && (
            <div className={`absolute z-[8] ${scene.annotationPlacement === "右下" ? "bottom-12 right-3" : "top-10 left-3"}`}>
              <div className="border border-white/40 bg-black/30 rounded px-2 py-1 text-white/70 text-[8px] leading-snug max-w-[180px] whitespace-pre-line">
                {scene.annotation}
              </div>
            </div>
          )}

          {/* Telop text */}
          {telopLines.length > 0 && (
            <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 z-10 text-center max-w-[90%]">
              {telopLines.map((line, i) => (
                <div key={i} className="text-white font-bold leading-tight text-[16px]"
                  style={{ textShadow: "0 0 6px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.7)" }}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Material label */}
          {scene.mainMaterial && (
            <div className="absolute bottom-10 left-3 right-3 z-[5]">
              <div className="text-[9px] text-white/50 bg-black/30 rounded px-2 py-0.5 text-center truncate">{scene.mainMaterial}</div>
            </div>
          )}

          {/* BGM change indicator */}
          {scene.bgmChange && (
            <div className="absolute top-10 left-3 z-[12]">
              <div className="text-[8px] text-yellow-300 bg-black/50 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                ♪ BGM変更
              </div>
            </div>
          )}

          {/* Play/Pause overlay */}
          <button
            onClick={() => setPlaying(!playing)}
            className="absolute inset-0 z-20 flex items-center justify-center group"
          >
            <div className={`w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity ${playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
              {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
            </div>
          </button>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 z-[18] h-1 bg-white/10">
            <div className="h-full bg-[#9333EA]/80 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
        </div>

        {/* Home bar */}
        <div className="w-[36px] h-[4px] bg-white/15 rounded-full mx-auto mb-[6px] shrink-0" />
      </div>
    </div>
  );
}

// ─── Scene Thumbnail ─────────────────────────────────
function SceneThumbnail({ scene, idx, isActive, onClick }: {
  scene: EditingScene; idx: number; isActive: boolean; onClick: () => void;
}) {
  const sc = SECTION_COLORS[scene.section] || SECTION_COLORS[""];
  const gradientIdx = idx % GRADIENT_COLORS.length;
  const telopLines = scene.telop.split("\n").filter((l) => l.trim());

  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-[52px] aspect-[9/16] rounded-[6px] border-2 relative overflow-hidden transition-all ${
        isActive ? "border-[#9333EA] shadow-md scale-105" : "border-[#1A1A2E]/10 hover:border-[#1A1A2E]/20"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT_COLORS[gradientIdx]}`} />
      <div className="absolute inset-0 bg-[#1a1a2e]/30" />
      {/* Mini telop */}
      {telopLines.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-0.5">
          <div className="text-[3px] text-white font-bold text-center leading-tight truncate"
            style={{ textShadow: "0 0 2px rgba(0,0,0,0.9)" }}>
            {telopLines[0]}
          </div>
        </div>
      )}
      {/* Scene number */}
      <div className="absolute bottom-0.5 left-0 right-0 text-center">
        <span className="text-[5px] font-bold text-white/60">{String(idx + 1).padStart(2, "0")}</span>
      </div>
      {/* Section color bar at top */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${sc.border.replace("border-t-", "bg-")}`} />
    </button>
  );
}

// ─── Scene Edit Card ─────────────────────────────────
function SceneCard({
  scene,
  idx,
  isActive,
  globalBgm,
  effectiveBgm,
  onUpdate,
  onAddSub,
  onRemoveSub,
  onUpdateSub,
  cardRef,
}: {
  scene: EditingScene;
  idx: number;
  isActive: boolean;
  globalBgm: string;
  effectiveBgm: string;
  onUpdate: (field: string, value: any) => void;
  onAddSub: () => void;
  onRemoveSub: (i: number) => void;
  onUpdateSub: (i: number, v: string) => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const sc = SECTION_COLORS[scene.section] || SECTION_COLORS[""];

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-xl border transition-all ${
        isActive ? "border-[#9333EA]/30 shadow-lg ring-1 ring-[#9333EA]/10" : "border-black/[0.06]"
      }`}
    >
      {/* Card header */}
      <div className={`px-4 py-2.5 border-b border-black/[0.04] flex items-center gap-2 rounded-t-xl border-t-2 ${sc.border}`}>
        <span className="text-[13px] font-bold text-[#1A1A2E]/70">{String(idx + 1).padStart(2, "0")}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sc.badgeBg} ${sc.text}`}>
          {scene.section}
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 space-y-3">
        {/* テキスト */}
        <div>
          <FieldLabel label="テキスト" />
          <AutoTextarea value={scene.text} readOnly className="text-[#1A1A2E]/50" />
        </div>

        {/* テロップ */}
        <div>
          <FieldLabel label="テロップ" />
          <AutoTextarea value={scene.telop} onChange={(v) => onUpdate("telop", v)} placeholder="テロップを入力" />
        </div>

        {/* 注釈 */}
        <div>
          <FieldLabel label="注釈" />
          {scene.annotation || true ? (
            <div className="flex gap-1 mb-1">
              {ANNOTATION_PLACEMENTS.map((p) => (
                <button key={p} onClick={() => onUpdate("annotationPlacement", p)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                    scene.annotationPlacement === p
                      ? "bg-[#9333EA]/10 text-[#9333EA] font-bold"
                      : "text-[#1A1A2E]/25 hover:text-[#1A1A2E]/50"
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          ) : null}
          <AutoTextarea value={scene.annotation} onChange={(v) => onUpdate("annotation", v)} placeholder="注釈を入力" />
        </div>

        {/* フォント */}
        <div>
          <FieldLabel label="フォント" />
          <SmartSelect value={scene.fontOverride} options={FONT_OPTIONS} topCount={3} onChange={(v) => onUpdate("fontOverride", v)} placeholder="変更なし" />
        </div>

        {/* BGM */}
        <div>
          <FieldLabel label="BGM" />
          <div className="text-[10px] text-[#1A1A2E]/30 mb-1 truncate px-1">♪ {effectiveBgm}</div>
          <button onClick={() => onUpdate("bgmChange", !scene.bgmChange)}
            className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all w-full text-left ${
              scene.bgmChange
                ? "bg-yellow-50 border-yellow-200 text-yellow-700 font-semibold"
                : "border-[#1A1A2E]/[0.06] text-[#1A1A2E]/30 hover:border-[#1A1A2E]/15"
            }`}>
            {scene.bgmChange ? "♪ ここから変更中" : "ここからBGM変更"}
          </button>
          {scene.bgmChange && (
            <input value={scene.bgmValue} onChange={(e) => onUpdate("bgmValue", e.target.value)}
              placeholder="新BGM名"
              className="w-full text-[11px] text-yellow-800 bg-yellow-50/50 border border-yellow-200 rounded-lg px-2.5 py-1.5 outline-none placeholder:text-yellow-400 mt-1" />
          )}
        </div>

        {/* メイン素材名 */}
        <div>
          <FieldLabel label="メイン素材名" />
          <input value={scene.mainMaterial} onChange={(e) => onUpdate("mainMaterial", e.target.value)}
            placeholder="メイン素材"
            className="w-full text-[12px] text-[#1A1A2E]/70 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2.5 py-1.5 outline-none placeholder:text-[#1A1A2E]/20" />
        </div>

        {/* サブ素材名 */}
        <div>
          <FieldLabel label="サブ素材名" />
          {scene.subMaterials.map((sub, i) => (
            <div key={i} className="flex items-center gap-1 group/sub mb-0.5">
              <input value={sub} onChange={(e) => onUpdateSub(i, e.target.value)}
                placeholder="サブ素材"
                className="w-full text-[12px] text-[#1A1A2E]/60 bg-transparent border border-transparent hover:border-black/[0.08] focus:border-[#9333EA]/40 rounded-lg px-2.5 py-1 outline-none placeholder:text-[#1A1A2E]/15" />
              {scene.subMaterials.length > 1 && (
                <button onClick={() => onRemoveSub(i)} className="text-red-400 opacity-0 group-hover/sub:opacity-100 shrink-0"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          <button onClick={onAddSub}
            className="flex items-center gap-0.5 text-[9px] text-[#1A1A2E]/20 hover:text-[#9333EA]/50 transition-colors mt-0.5 px-1">
            <Plus className="w-3 h-3" /><span>追加</span>
          </button>
        </div>

        {/* モーションエフェクト */}
        <div>
          <FieldLabel label="モーションエフェクト" />
          <SmartSelect value={scene.motionEffect} options={ME_OPTIONS} topCount={3} onChange={(v) => onUpdate("motionEffect", v)} placeholder="選択" />
        </div>

        {/* サウンドエフェクト */}
        <div>
          <FieldLabel label="サウンドエフェクト" />
          <SmartSelect value={scene.soundEffect} options={SE_OPTIONS} topCount={3} onChange={(v) => onUpdate("soundEffect", v)} placeholder="選択" />
        </div>

        {/* コメント */}
        <div>
          <FieldLabel label="コメント" />
          <AutoTextarea value={scene.comment} onChange={(v) => onUpdate("comment", v)} placeholder="このシーンへのコメント..." />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function EditingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [scenes, setScenes] = useState<EditingScene[]>(makeInitialScenes);
  const [activeIdx, setActiveIdx] = useState(0);
  const [globalBgm] = useState("BGM-01: アップテンポ・ポジティブ");
  const [globalFeedback, setGlobalFeedback] = useState("");

  // Refs for card scroll sync
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const editScrollRef = useRef<HTMLDivElement | null>(null);
  const isScrollingFromClick = useRef(false);

  // Active row ref for voice input
  const activeSceneIdRef = useRef<number | null>(null);

  // Compute effective BGM for a scene index
  const getEffectiveBgm = useCallback((idx: number) => {
    let eff = globalBgm;
    for (let i = 0; i <= idx; i++) {
      if (scenes[i].bgmChange && scenes[i].bgmValue) eff = scenes[i].bgmValue;
    }
    return eff;
  }, [scenes, globalBgm]);

  // Scene update
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

  // Click thumbnail -> scroll card into view + set active
  const selectScene = useCallback((idx: number) => {
    setActiveIdx(idx);
    isScrollingFromClick.current = true;
    const card = cardRefs.current[scenes[idx]?.id];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => { isScrollingFromClick.current = false; }, 600);
  }, [scenes]);

  // Scroll sync: scrolling edit cards updates active scene
  const handleEditScroll = useCallback(() => {
    if (isScrollingFromClick.current) return;
    const container = editScrollRef.current;
    if (!container) return;
    const containerTop = container.scrollTop + 60;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < scenes.length; i++) {
      const card = cardRefs.current[scenes[i].id];
      if (!card) continue;
      const dist = Math.abs(card.offsetTop - containerTop);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setActiveIdx(closest);
  }, [scenes]);

  // Voice input handlers
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

  // Update active scene ref
  useEffect(() => {
    activeSceneIdRef.current = scenes[activeIdx]?.id ?? null;
  }, [activeIdx, scenes]);

  const activeScene = scenes[activeIdx];

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* ── Top: コンセプト + 広告企画 ── */}
      <TopCards />

      {/* ── Middle: Preview (left) + Edit (right) ── */}
      <div className="flex-1 flex min-h-0">

        {/* ── Left: Preview (~40%) ── */}
        <div className="w-[40%] shrink-0 flex flex-col border-r border-black/[0.06] bg-[#F5F3F0]">
          {/* Large phone preview */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {activeScene && (
              <PhonePreview scene={activeScene} idx={activeIdx} total={scenes.length} />
            )}
          </div>

          {/* Scene thumbnail strip */}
          <div className="shrink-0 border-t border-black/[0.06] bg-white px-3 py-2.5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {scenes.map((scene, idx) => (
                <SceneThumbnail
                  key={scene.id}
                  scene={scene}
                  idx={idx}
                  isActive={idx === activeIdx}
                  onClick={() => selectScene(idx)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Edit area (~60%) ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Scrollable cards */}
          <div
            ref={editScrollRef}
            onScroll={handleEditScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {scenes.map((scene, idx) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                idx={idx}
                isActive={idx === activeIdx}
                globalBgm={globalBgm}
                effectiveBgm={getEffectiveBgm(idx)}
                onUpdate={(field, value) => updateScene(scene.id, field, value)}
                onAddSub={() => addSubMaterial(scene.id)}
                onRemoveSub={(i) => removeSubMaterial(scene.id, i)}
                onUpdateSub={(i, v) => updateSubMaterial(scene.id, i, v)}
                cardRef={(el) => { cardRefs.current[scene.id] = el; }}
              />
            ))}

            {/* Global feedback area */}
            <div className="bg-white rounded-xl border border-black/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-bold text-[#1A1A2E]/60">全体フィードバック</span>
              </div>
              <AutoTextarea
                value={globalFeedback}
                onChange={setGlobalFeedback}
                placeholder="動画全体へのフィードバック・メモ..."
              />
            </div>

            {/* Bottom spacing for voice button */}
            <div className="h-20" />
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 bg-white border-t border-black/[0.06] px-5 py-3 flex items-center justify-between">
        <Link
          href={`/projects/${projectId}/edit-brief`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1A1A2E]/10 text-[12px] font-semibold text-[#1A1A2E]/50 hover:border-[#9333EA]/30 hover:text-[#9333EA] transition-all"
        >
          <Check className="w-3.5 h-3.5" />
          クライアントチェック
        </Link>
        <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#9333EA] text-white text-[12px] font-semibold hover:bg-[#7E22CE] transition-colors shadow-sm">
          納品
        </button>
      </div>

      {/* ── Voice Input Button ── */}
      <VoiceInputButton
        onTranscript={handleVoiceTranscript}
        onFeedback={handleVoiceFeedback}
      />
    </div>
  );
}
