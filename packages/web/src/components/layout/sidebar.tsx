"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquarePlus,
  LayoutDashboard,
  Clapperboard,
  Radio,
  LineChart,
  Trophy,
  BookOpen,
  ChevronDown,
  MessageSquare,
  ClipboardList,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useProject } from "@/components/providers/project-provider";

const NAV_ITEMS = [
  { label: "新しいチャット", href: "/", icon: MessageSquarePlus },
  { label: "ダッシュボード", href: "/dashboard", icon: LayoutDashboard },
  { label: "制作", href: "/projects", icon: Clapperboard },
  { label: "運用", href: "/operations", icon: Radio },
  { label: "レポーティング", href: "/reports", icon: LineChart },
  { label: "クリエイティブ", href: "/creatives", icon: Trophy },
  { label: "ナレッジ", href: "/knowledge", icon: BookOpen },
  { label: "連携の準備", href: "/setup/gcp-issue-job", icon: ClipboardList },
];

const CHAT_HISTORY = [
  "新商品のLP改善案を考えて",
  "競合分析レポートの作成",
  "SNS投稿のキャプション生成",
  "Q4キャンペーン企画案",
  "ターゲット層の分析",
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const isChatPage = pathname === "/";
  const { projects, currentProject, setCurrentProjectId } = useProject();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (collapsed) {
    return (
      <aside className="w-[56px] h-screen flex flex-col shrink-0 border-r border-white/[0.08] items-center py-3" style={{ background: "#151528" }}>
        <button onClick={onToggle} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors mb-4">
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <nav className="space-y-1 w-full px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center justify-center py-2 rounded-lg transition-all ${
                  isActive ? "bg-white/[0.08] text-white" : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                }`}
                title={item.label}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-[#C084FC]" : ""}`} />
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <div className="w-7 h-7 rounded-full gradient-warm flex items-center justify-center text-white text-[11px] font-bold">田</div>
      </aside>
    );
  }

  return (
    <aside className="w-[220px] h-screen flex flex-col shrink-0 border-r border-white/[0.08]" style={{ background: "#151528" }}>
      {/* Brand + toggle */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight gradient-warm-text text-center">
            ZENNOU
          </h1>
          <p className="text-[13px] gradient-warm-text text-center tracking-wider mt-1 font-bold opacity-80">売れるBUZZ AI</p>
        </div>
        <button onClick={onToggle} className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white/60 transition-colors mt-1">
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Project selector */}
      <div className="px-4 pb-4 relative" ref={selectorRef}>
        <button
          onClick={() => setSelectorOpen(!selectorOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:bg-white/[0.07] transition-colors"
        >
          <span className="flex-1 text-left truncate">{currentProject.name}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-white/30 shrink-0 transition-transform ${selectorOpen ? "rotate-180" : ""}`} />
        </button>
        {selectorOpen && (
          <div className="absolute left-4 right-4 top-full mt-1 rounded-lg border border-white/[0.08] bg-[#1e1e38] shadow-xl z-50 overflow-hidden">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { setCurrentProjectId(p.id); setSelectorOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  p.id === currentProject.id
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                <span className="flex-1 text-left truncate">{p.name}</span>
                {p.id === currentProject.id && <Check className="w-3.5 h-3.5 text-[#C084FC] shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all
                ${
                  isActive
                    ? "bg-white/[0.08] text-white font-semibold"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                }
              `}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#C084FC]" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Chat history — only visible on chat page */}
      {isChatPage && (
        <div className="mt-6 px-4 flex-1 overflow-y-auto">
          <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2">
            チャット履歴
          </p>
          <div className="space-y-0.5">
            {CHAT_HISTORY.map((title, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-white/35 hover:bg-white/[0.04] hover:text-white/60 transition-colors text-left"
              >
                <MessageSquare className="w-3 h-3 shrink-0 text-white/20" />
                <span className="truncate">{title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spacer when not chat page */}
      {!isChatPage && <div className="flex-1" />}

      {/* User */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full gradient-warm flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            田
          </div>
          <span className="text-[13px] text-white/70 font-medium">田中太郎</span>
        </div>
      </div>
    </aside>
  );
}
