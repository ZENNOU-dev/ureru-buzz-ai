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

  // Determine active tab from pathname, default to "scripts"
  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  const currentSegment = lastSegment === projectId ? "scripts" : lastSegment;

  return (
    <div className="flex flex-col h-screen">
      {/* Project Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/projects"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-zinc-900">
                案件: {projectId}
              </h1>
              <p className="text-xs text-zinc-500">ID: {projectId}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = currentSegment === tab.segment;
              const href = `/projects/${projectId}/${tab.segment}`;
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={`
                    px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                    ${
                      isActive
                        ? "border-zinc-900 text-zinc-900"
                        : "border-transparent text-zinc-400 hover:text-zinc-600 hover:border-zinc-300"
                    }
                  `}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">{children}</div>
    </div>
  );
}
