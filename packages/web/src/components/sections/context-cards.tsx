"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Megaphone, Lightbulb } from "lucide-react";

export function ContextCards() {
  const [appealOpen, setAppealOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* 訴求カード */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setAppealOpen(!appealOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors"
        >
          <Megaphone className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-sm font-semibold text-zinc-900 flex-1">
            訴求
          </span>
          <span className="text-[11px] text-zinc-400 mr-2">
            AIフリーランス転身訴求
          </span>
          {appealOpen ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>
        {appealOpen && (
          <div className="px-4 pb-3 border-t border-zinc-100 pt-2 space-y-1.5 text-xs text-zinc-600">
            <div>
              <span className="font-semibold text-zinc-500">訴求名:</span>{" "}
              AIフリーランス転身訴求
            </div>
            <div>
              <span className="font-semibold text-zinc-500">WHO:</span>{" "}
              会社員で給料・環境に不満を持つ20-30代
            </div>
            <div>
              <span className="font-semibold text-zinc-500">WHAT:</span>{" "}
              AI活用フリーランスとして収入アップ
            </div>
            <div>
              <span className="font-semibold text-zinc-500">WHY:</span>{" "}
              AIスキル×SNS運用で未経験からでも短期間で成果が出せる
            </div>
          </div>
        )}
      </div>

      {/* 広告企画カード */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setPlanOpen(!planOpen)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors"
        >
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-zinc-900 flex-1">
            広告企画
          </span>
          <span className="text-[11px] text-zinc-400 mr-2">
            フリーランス2.0体験談
          </span>
          {planOpen ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>
        {planOpen && (
          <div className="px-4 pb-3 border-t border-zinc-100 pt-2 space-y-1.5 text-xs text-zinc-600">
            <div>
              <span className="font-semibold text-zinc-500">企画名:</span>{" "}
              フリーランス2.0体験談
            </div>
            <div>
              <span className="font-semibold text-zinc-500">興味の型:</span>{" "}
              体験談 / ビフォーアフター
            </div>
            <div>
              <span className="font-semibold text-zinc-500">構成の型:</span>{" "}
              フック→共感→コンセプト→商品紹介→ベネフィット→CTA
            </div>
            <div>
              <span className="font-semibold text-zinc-500">FVテキスト:</span>{" "}
              未経験ならAIフリーランスめちゃチャンスです
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
