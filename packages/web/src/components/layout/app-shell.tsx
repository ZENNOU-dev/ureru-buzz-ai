"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { GlobalUndoProvider } from "@/components/providers/global-undo-provider";
import { ProjectProvider } from "@/components/providers/project-provider";
import { LocalBackendStatusBanner } from "@/components/layout/local-backend-status-banner";
import { Sidebar } from "./sidebar";
import { FloatingChat } from "./floating-chat";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoginPage) {
    return (
      <GlobalUndoProvider>
        <LocalBackendStatusBanner />
        {children}
      </GlobalUndoProvider>
    );
  }

  return (
    <GlobalUndoProvider>
      <ProjectProvider>
        <div className="flex h-full bg-background text-foreground">
          <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex flex-1 flex-col overflow-y-auto">
            <LocalBackendStatusBanner />
            {children}
          </main>
          <FloatingChat />
        </div>
      </ProjectProvider>
    </GlobalUndoProvider>
  );
}
