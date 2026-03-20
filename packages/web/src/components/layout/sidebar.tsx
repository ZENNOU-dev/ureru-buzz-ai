"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BarChart3,
  Clapperboard,
  Radio,
  LineChart,
  Trophy,
  BookOpen,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "AIチャット", href: "/", icon: Bot },
  { label: "ダッシュボード", href: "/dashboard", icon: BarChart3 },
  { label: "制作", href: "/projects", icon: Clapperboard },
  { label: "運用", href: "/operations", icon: Radio },
  { label: "レポーティング", href: "/reports", icon: LineChart },
  { label: "クリエイティブ", href: "/creatives", icon: Trophy },
  { label: "ナレッジ", href: "/knowledge", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen bg-zinc-950 text-zinc-300 flex flex-col border-r border-zinc-800 shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-base font-bold text-white tracking-tight">
          売れるBUZZ AI
        </h1>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          ショート動画広告 PDCA AI
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
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
                flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                ${isActive
                  ? "bg-zinc-800/80 text-white font-medium"
                  : "hover:bg-zinc-800/40 hover:text-white"
                }
              `}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-zinc-800 text-[10px] text-zinc-600">
        v0.1.0 MVP
      </div>
    </aside>
  );
}
