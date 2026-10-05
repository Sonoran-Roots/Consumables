"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { AUDIT_PREFIX, auditRolesAllowedFor, isAuditRole, modulesFor } from "@/lib/access";
import JarsLogo from "./jars-logo";

// The Inventory Audit module's own navigation. Deliberately does not import
// or reuse the Consumable Management sidebar — the two modules only share
// logins and the admin console.
type Leaf = { href: string; label: string };
const LINKS: Leaf[] = [
  { href: AUDIT_PREFIX, label: "Dashboard" },
  { href: `${AUDIT_PREFIX}/findings`, label: "Findings" },
  { href: `${AUDIT_PREFIX}/findings/new`, label: "Add finding" },
  { href: `${AUDIT_PREFIX}/upload`, label: "Upload findings" },
  { href: `${AUDIT_PREFIX}/settings`, label: "Settings" },
];

export default function AuditSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as
    | { name?: string; email: string; isPurchasingTeam?: boolean; auditRole?: string | null }
    | undefined;
  const hasBothModules = user ? modulesFor(user).length > 1 : false;

  return (
    <nav className="flex h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2 bg-black px-3">
        <Link href={AUDIT_PREFIX} className="shrink-0" title="Inventory Audit home">
          <JarsLogo size={40} />
        </Link>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate whitespace-nowrap text-[13px] font-black tracking-tight text-white">
            JARS Cannabis Arizona
          </span>
          <span className="block truncate text-[9px] font-semibold tracking-[0.1em] text-white/60">
            INVENTORY AUDIT
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {LINKS.filter((leaf) => isAuditRole(user?.auditRole) && auditRolesAllowedFor(leaf.href).includes(user!.auditRole as never)).map((leaf) => {
          // "Findings" must not light up while on "Add finding".
          const active =
            leaf.href === AUDIT_PREFIX || leaf.href === `${AUDIT_PREFIX}/findings`
              ? pathname === leaf.href || (leaf.href !== AUDIT_PREFIX && pathname.startsWith(leaf.href + "/") && !pathname.startsWith(`${AUDIT_PREFIX}/findings/new`))
              : pathname.startsWith(leaf.href);
          return (
            <Link
              key={leaf.href}
              href={leaf.href}
              className={`mx-2 my-0.5 block rounded-md px-2.5 py-2 text-sm font-medium ${
                active ? "bg-[#e5f3e5] text-[#0e3020]" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {leaf.label}
            </Link>
          );
        })}
      </div>

      {user && (
        <div className="shrink-0 space-y-1 border-t border-gray-200 p-2">
          {hasBothModules && (
            <Link
              href="/modules"
              className="block rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Switch module
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e5f3e5] text-xs font-semibold text-[#0e3020]">
              {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{user.name || user.email}</p>
              <button
                type="button"
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        router.push("/sign-in");
                        router.refresh();
                      },
                    },
                  })
                }
                className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
