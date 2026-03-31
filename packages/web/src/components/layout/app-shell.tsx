"use client";

import { usePathname } from "next/navigation";
import { GlobalUndoProvider } from "@/components/providers/global-undo-provider";
import { LocalBackendStatusBanner } from "@/components/layout/local-backend-status-banner";
import { Sidebar } from "./sidebar";
import { FloatingChat } from "./floating-chat";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

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
      <div className="flex h-full bg-background text-foreground">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <LocalBackendStatusBanner />
          {children}
        </main>
        <FloatingChat />
      </div>
    </GlobalUndoProvider>
  );
}
