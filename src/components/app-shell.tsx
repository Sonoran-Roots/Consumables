"use client";

import { usePathname } from "next/navigation";
import { isAuditPath } from "@/lib/access";
import Sidebar from "./sidebar";
import AuditSidebar from "./audit-sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isKiosk = pathname?.startsWith("/kiosk");
  const isAuthPage = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up");
  const isModulePicker = pathname === "/modules";

  if (isKiosk || isAuthPage || isModulePicker) {
    return <main className="min-h-full w-full">{children}</main>;
  }

  // Each module has its own sidebar; they share nothing but the page frame.
  return (
    <>
      {pathname && isAuditPath(pathname) ? <AuditSidebar /> : <Sidebar />}
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </>
  );
}
