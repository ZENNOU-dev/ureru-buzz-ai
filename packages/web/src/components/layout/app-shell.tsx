"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { FloatingChat } from "./floating-chat";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto">{children}</main>
      <FloatingChat />
    </div>
  );
}
