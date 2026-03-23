"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import type { Scene } from "./scene-row";

const SECTION_ORDER = [
  "フック",
  "共感",
  "コンセプト",
  "商品紹介",
  "ベネフィット",
  "オファー",
  "CTA",
];

const SECTION_COLORS: Record<string, string> = {
  フック: "bg-rose-100 text-rose-700 border-rose-200",
  共感: "bg-blue-100 text-blue-700 border-blue-200",
  コンセプト: "bg-emerald-100 text-emerald-700 border-emerald-200",
  商品紹介: "bg-amber-100 text-amber-700 border-amber-200",
  ベネフィット: "bg-purple-100 text-purple-700 border-purple-200",
  オファー: "bg-orange-100 text-orange-700 border-orange-200",
  CTA: "bg-pink-100 text-pink-700 border-pink-200",
};

/**
 * Simple rule-based auto-classification for MVP.
 * In production, this would call Claude API.
 */
function classifyLine(text: string, index: number, totalLines: number): string {
  const t = text.toLowerCase();
  const position = index / totalLines;

  // Keyword-based hints
  if (
    t.includes("チャンス") ||
    t.includes("びっくり") ||
    t.includes("衝撃") ||
    t.includes("ヤバい") ||
    t.includes("知ってた") ||
    t.includes("まだ") ||
    t.includes("実は")
  )
    return position < 0.3 ? "フック" : "ベネフィット";

  if (
    t.includes("辞め") ||
    t.includes("変わらない") ||
    t.includes("つらい") ||
    t.includes("不安") ||
    t.includes("悩み")
  )
    return "共感";

  if (
    t.includes("出会った") ||
    t.includes("そんな時") ||
    t.includes("これが") ||
    t.includes("だから")
  )
    return "コンセプト";

  if (
    t.includes("スクール") ||
    t.includes("使える") ||
    t.includes("学習") ||
    t.includes("講座") ||
    t.includes("機能") ||
    t.includes("サービス") ||
    t.includes("AI") ||
    t.includes("ツール")
  )
    return "商品紹介";

  if (
    t.includes("万バズ") ||
    t.includes("収入") ||
    t.includes("月収") ||
    t.includes("稼") ||
    t.includes("成功")
  )
    return "ベネフィット";

  if (
    t.includes("無料") ||
    t.includes("今なら") ||
    t.includes("限定") ||
    t.includes("キャンペーン")
  )
    return "オファー";

  if (
    t.includes("リンク") ||
    t.includes("プロフィール") ||
    t.includes("クリック") ||
    t.includes("今すぐ") ||
    t.includes("詳しく")
  )
    return "CTA";

  // Position-based fallback
  if (position < 0.15) return "フック";
  if (position < 0.25) return "共感";
  if (position < 0.35) return "コンセプト";
  if (position < 0.7) return "商品紹介";
  if (position < 0.85) return "ベネフィット";
  if (position < 0.93) return "オファー";
  return "CTA";
}

/**
 * Split bulk text into scenes by double-newline (paragraph = scene).
 * Within a scene, single newlines are preserved as telop line breaks.
 */
function splitIntoScenes(text: string): string[] {
  // Split by empty lines (double newline) as scene boundaries
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function BulkInput({
  onGenerate,
}: {
  onGenerate: (scenes: Scene[]) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<
    Array<{ text: string; section: string }>
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(300, textareaRef.current.scrollHeight)}px`;
    }
  }, [text]);

  const handleClassify = () => {
    if (!text.trim()) return;

    const lines = splitIntoScenes(text);
    const classified = lines.map((line, i) => ({
      text: line,
      section: classifyLine(line, i, lines.length),
    }));

    setPreview(classified);
    setShowPreview(true);
  };

  const handleApply = () => {
    const scenes: Scene[] = preview.map((item, i) => ({
      id: i + 1,
      section: item.section,
      text: item.text,
      annotation: "",
      regulationWarning: "",
      regulationCheck: false,
      materialName: "",
      materialUrl: "",
      telop: item.text, // テロップ = 台本テキストをそのままコピー
      cut: "",
      me: "",
      se: "",
      revision: "",
    }));
    onGenerate(scenes);
  };

  const updatePreviewSection = (index: number, newSection: string) => {
    setPreview((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], section: newSection };
      return next;
    });
  };

  const lineCount = text.split(/\n{2,}/).filter((s) => s.trim()).length;
  const charCount = text.replace(/\n/g, "").length;

  return (
    <div className="space-y-4">
      {/* Input Area */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-600">
              📝 台本テキスト一括入力
            </span>
            <span className="text-[10px] text-zinc-400">
              空行でシーンを区切ります
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-400">
            <span>{lineCount} シーン</span>
            <span>{charCount} 文字</span>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setShowPreview(false);
          }}
          placeholder={`台本テキストを貼り付けてください\n\n（例）\n未経験なら\nAIフリーランス\nめちゃチャンスです🥺\n\nAIのおかげで\n収入変わりすぎて\n正直びっくり🤩\n\n給料・職場環境\n変わらない\n会社員辞めて`}
          className="w-full min-h-[300px] px-5 py-4 text-sm leading-relaxed text-zinc-700 placeholder:text-zinc-300 outline-none resize-none font-mono"
        />

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 bg-zinc-50">
          <span className="text-[10px] text-zinc-400">
            💡 空行（2回改行）= シーンの区切り ／ 1回の改行 = テロップの改行
          </span>
          <button
            onClick={handleClassify}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI分類プレビュー
          </button>
        </div>
      </div>

      {/* Preview */}
      {showPreview && preview.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
            <span className="text-xs font-semibold text-zinc-600">
              ✨ AI分類プレビュー（{preview.length}シーン）
            </span>
            <span className="text-[10px] text-zinc-400">
              パートラベルをクリックして変更できます
            </span>
          </div>

          <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
            {preview.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-[10px] font-bold text-zinc-300 pt-1 w-6 text-right shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Section selector */}
                <select
                  value={item.section}
                  onChange={(e) => updatePreviewSection(i, e.target.value)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer outline-none shrink-0 ${SECTION_COLORS[item.section] || "bg-zinc-100 text-zinc-500 border-zinc-200"}`}
                >
                  {SECTION_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Text preview */}
                <span className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed flex-1">
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              テキストに戻る
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              シーンカードに展開
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
