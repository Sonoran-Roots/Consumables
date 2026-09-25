"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isKiosk = pathname?.startsWith("/kiosk");

  if (isKiosk) {
    return <main className="min-h-full w-full">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </>
  );
}
