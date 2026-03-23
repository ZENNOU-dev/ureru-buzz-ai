"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { ArrowLeft } from "lucide-react";

const TABS = [
  { label: "リサーチ", segment: "research" },
  { label: "訴求開発", segment: "appeals" },
  { label: "広告企画", segment: "planning" },
  { label: "台本", segment: "scripts" },
  { label: "編集概要", segment: "edit-brief" },
  { label: "編集", segment: "editing" },
  { label: "素材", segment: "materials" },
  { label: "レギュレーション", segment: "regulations" },
];

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  const currentSegment = lastSegment === projectId ? "scripts" : lastSegment;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-black/[0.06] shrink-0">
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/projects" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.04] transition-colors text-[#1A1A2E]/30 hover:text-[#9333EA]">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-[#1A1A2E]">DOT-AI</h1>
              <p className="text-xs text-[#1A1A2E]/30">ID: {projectId}</p>
            </div>
          </div>
          <nav className="flex gap-0 -mb-px overflow-x-auto relative">
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-[#FF6B9D] via-[#22D3EE] to-[#C084FC] opacity-15" />
            {TABS.map((tab) => {
              const isActive = currentSegment === tab.segment;
              return (
                <Link key={tab.segment} href={`/projects/${projectId}/${tab.segment}`}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative z-10 ${isActive ? "border-[#9333EA] text-[#1A1A2E]" : "border-transparent text-[#1A1A2E]/35 hover:text-[#1A1A2E]/60 hover:border-[#1A1A2E]/15"}`}>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">{children}</div>
    </div>
  );
}
