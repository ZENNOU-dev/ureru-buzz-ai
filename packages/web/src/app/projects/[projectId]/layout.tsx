"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { ArrowLeft } from "lucide-react";

// Group: 企画(紫) / 制作(青) / 制作管理(オレンジ)
const TAB_GROUPS = [
  {
    color: { active: "border-[#9333EA] text-[#9333EA]", inactive: "text-[#9333EA]/30 hover:text-[#9333EA]/60" },
    tabs: [
      { label: "リサーチ", segment: "research" },
      { label: "訴求開発", segment: "appeals" },
      { label: "広告企画", segment: "planning" },
    ],
  },
  {
    color: { active: "border-[#2563EB] text-[#2563EB]", inactive: "text-[#2563EB]/30 hover:text-[#2563EB]/60" },
    tabs: [
      { label: "台本", segment: "scripts" },
      { label: "編集概要", segment: "edit-brief" },
      { label: "編集", segment: "editing" },
      { label: "動画", segment: "deliverables" },
    ],
  },
  {
    color: { active: "border-[#EA580C] text-[#EA580C]", inactive: "text-[#EA580C]/30 hover:text-[#EA580C]/60" },
    tabs: [
      { label: "素材", segment: "materials" },
      { label: "撮影", segment: "shooting" },
      { label: "レギュレーション", segment: "regulations" },
    ],
  },
];

const ALL_TABS = TAB_GROUPS.flatMap((g) => g.tabs);

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
          <nav className="flex gap-0 -mb-px overflow-x-auto relative items-end">
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-[#9333EA]/15 via-[#2563EB]/15 to-[#EA580C]/15" />
            {TAB_GROUPS.map((group, gi) => (
              <div key={gi} className="flex items-end">
                {group.tabs.map((tab) => {
                  const isActive = currentSegment === tab.segment;
                  return (
                    <Link key={tab.segment} href={`/projects/${projectId}/${tab.segment}`}
                      className={`px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors relative z-10 ${
                        isActive ? `${group.color.active} font-semibold` : `border-transparent ${group.color.inactive}`
                      }`}>
                      {tab.label}
                    </Link>
                  );
                })}
                {gi < TAB_GROUPS.length - 1 && (
                  <div className="h-5 w-px bg-[#1A1A2E]/8 mx-1 mb-2.5 shrink-0" />
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">{children}</div>
    </div>
  );
}
