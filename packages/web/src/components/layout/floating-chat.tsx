"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, ChevronDown } from "lucide-react";

const CHAT_HISTORY = [
  "新商品のLP改善案を考えて",
  "競合分析レポートの作成",
  "SNS投稿のキャプション生成",
];

export function FloatingChat() {
  const pathname = usePathname();
  const isChatPage = pathname === "/";
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  // Don't show on chat page (it IS the chat page) or login
  if (isChatPage || pathname === "/login") return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full gradient-warm flex items-center justify-center shadow-lg shadow-[#FF6B9D]/20 hover:scale-105 active:scale-95 transition-transform z-50"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[520px] rounded-2xl overflow-hidden flex flex-col z-50 shadow-2xl shadow-black/20 border border-black/[0.08] bg-white">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-black/[0.06] bg-[#FAF8F5]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-warm flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#1A1A2E]">ZENNOU <span className="text-[10px] font-semibold text-[#1A1A2E]/40">売れるBUZZ AI</span></p>
                <p className="text-[10px] text-[#1A1A2E]/35">いつでも相談できます</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/40 hover:text-[#1A1A2E]/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat history dropdown */}
          <div className="px-3 py-2 border-b border-black/[0.04]">
            <details className="group">
              <summary className="flex items-center gap-1.5 text-[11px] text-[#1A1A2E]/30 cursor-pointer hover:text-[#1A1A2E]/50 transition-colors list-none">
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                チャット履歴
              </summary>
              <div className="mt-1.5 space-y-0.5">
                {CHAT_HISTORY.map((title, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] text-[#1A1A2E]/40 hover:bg-black/[0.03] hover:text-[#1A1A2E]/60 transition-colors text-left"
                  >
                    <MessageSquare className="w-3 h-3 shrink-0 text-[#1A1A2E]/20" />
                    <span className="truncate">{title}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FAF8F5] flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-[#1A1A2E]/20" />
              </div>
              <p className="text-[13px] text-[#1A1A2E]/30 text-center">
                質問や相談をどうぞ
              </p>
            </div>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-black/[0.06]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="質問を入力..."
                className="flex-1 px-3 py-2 rounded-lg bg-[#FAF8F5] border border-black/[0.08] text-[13px] text-[#1A1A2E] placeholder:text-[#1A1A2E]/25 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-colors"
              />
              <button className="w-9 h-9 rounded-lg gradient-warm flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
