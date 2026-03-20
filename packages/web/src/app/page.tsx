"use client";

import { Bot, Send } from "lucide-react";
import { useState } from "react";

export default function ChatPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white">
        <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
          <Bot className="w-5 h-5" />
          AIチャット
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          広告制作をAIがサポートします
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Coming Soon overlay */}
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center">
            <Bot className="w-10 h-10 text-zinc-300" />
          </div>
          <p className="text-lg font-semibold text-zinc-400">
            AIチャット
          </p>
          <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 font-medium">
            Coming Soon
          </span>
          <p className="text-sm text-zinc-400 max-w-md text-center mt-2">
            AIエージェントがショート動画広告の企画・台本作成・運用をサポートします
          </p>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 bg-white p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="AIに質問する..."
            disabled
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-400 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed"
          />
          <button
            disabled
            className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
