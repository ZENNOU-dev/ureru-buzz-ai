"use client";

import { Send } from "lucide-react";
import { useUndoableState } from "@/hooks/use-undoable-state";
import { useBindPageUndo } from "@/components/providers/global-undo-provider";

const SUGGESTIONS = [
  { emoji: "📊", text: "競合の広告クリエイティブを分析して" },
  { emoji: "📝", text: "新商品の台本を作成して" },
  { emoji: "🎯", text: "ターゲット層の訴求ポイントを整理して" },
  { emoji: "🔍", text: "直近のパフォーマンスを分析して" },
];

type ChatDraft = { message: string };

export default function ChatPage() {
  const [draft, setDraft, { undo, redo }] = useUndoableState<ChatDraft>(() => ({ message: "" }), { mergeWindowMs: 400 });
  useBindPageUndo(undo, redo);
  const message = draft.message;
  const setMessage = (v: string) => setDraft((s) => ({ ...s, message: v }));

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-4xl font-black tracking-tight gradient-warm-text mb-2">
          ZENNOU
        </h1>
        <p className="text-lg font-bold gradient-warm-text opacity-80 mb-10">売れるBUZZ AI</p>
        <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl content-card content-card-hover text-left text-[13px] text-[#1A1A2E]/70 hover:text-[#1A1A2E] transition-all"
            >
              <span className="text-lg">{s.emoji}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 pb-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="質問を入力してください..."
            className="flex-1 px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-sm text-[#1A1A2E] placeholder:text-[#1A1A2E]/30 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-colors"
          />
          <button className="px-5 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] gradient-warm">
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
