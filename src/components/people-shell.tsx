"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { MODULE_HOME, modulesFor, type ModuleKey } from "@/lib/access";
import JarsLogo from "./jars-logo";

const MODULE_NAME: Record<ModuleKey, string> = { CONSUMABLES: "Consumable Management", AUDIT: "Inventory Audit" };

// The frame for pages that belong to every module (Employees & access): a top
// bar instead of a module's sidebar, with a way back into each module the
// signed-in person can open.
export default function PeopleShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email: string; isPurchasingTeam?: boolean; auditRole?: string | null } | undefined;
  const modules = user ? modulesFor(user) : [];

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 flex-wrap items-center gap-3 bg-black px-4">
        <JarsLogo size={40} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-black tracking-tight text-white">JARS Cannabis Arizona</span>
          <span className="block truncate text-[9px] font-semibold tracking-[0.1em] text-white/60">EMPLOYEES &amp; ACCESS</span>
        </span>
        <nav className="flex items-center gap-1">
          {modules.map((m) => (
            <Link key={m} href={MODULE_HOME[m]} className="rounded-md px-2.5 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
              {MODULE_NAME[m]}
            </Link>
          ))}
          {user && (
            <button
              type="button"
              onClick={() => signOut({ fetchOptions: { onSuccess: () => { router.push("/sign-in"); router.refresh(); } } })}
              className="rounded-md px-2.5 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          )}
        </nav>
      </header>
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
