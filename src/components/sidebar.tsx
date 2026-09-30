"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { minRoleFor, roleAtLeast } from "@/lib/access";
import {
  ChevronLeftIcon,
  ChevronDownIcon,
  DashboardIcon,
  BoxIcon,
  SwapIcon,
  CartIcon,
  GearIcon,
} from "./icons";
import type { ComponentType } from "react";
import JarsLogo from "./jars-logo";

type Leaf = { href: string; label: string };
type Group = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  children?: Leaf[];
};

const GROUPS: Group[] = [
  { key: "dashboard", label: "Dashboard", icon: DashboardIcon, href: "/" },
  {
    key: "inventory",
    label: "Inventory",
    icon: BoxIcon,
    children: [
      { href: "/inventory", label: "Current inventory" },
      { href: "/items", label: "Items" },
      { href: "/import", label: "Import" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: SwapIcon,
    children: [
      { href: "/transfers", label: "Transfers" },
      { href: "/checkouts", label: "Checkouts" },
      { href: "/audits", label: "Audits" },
      { href: "/reconciliation", label: "Reconciliation" },
    ],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    icon: CartIcon,
    children: [
      { href: "/purchasing", label: "Purchase orders" },
      { href: "/vendors", label: "Vendors" },
    ],
  },
  {
    key: "setup",
    label: "Setup",
    icon: GearIcon,
    children: [
      { href: "/sites", label: "Sites & books" },
      { href: "/employees", label: "Employees" },
      { href: "/categories", label: "Categories" },
      { href: "/units", label: "Units of measure" },
    ],
  },
];

// Mirrors src/lib/access.ts's route matrix so the sidebar never shows a
// link the proxy would just bounce off — purely a UX nicety, not the
// security boundary (the proxy re-checks on every navigation regardless).
function visibleGroups(role: string | undefined): Group[] {
  return GROUPS.map((group) => {
    if (group.href) {
      return roleAtLeast(role, minRoleFor(group.href)) ? group : null;
    }
    const children = (group.children ?? []).filter((leaf) =>
      roleAtLeast(role, minRoleFor(leaf.href))
    );
    return children.length > 0 ? { ...group, children } : null;
  }).filter((g): g is Group => g !== null);
}

function isGroupActive(group: Group, pathname: string) {
  if (group.href) return group.href === "/" ? pathname === "/" : pathname.startsWith(group.href);
  return (group.children ?? []).some((c) => pathname.startsWith(c.href));
}

const COLLAPSE_KEY = "sidebar-collapsed";
let collapseListeners: Array<() => void> = [];

function setCollapsedStore(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, String(value));
  } catch {
    // ignore — per-viewer convenience only
  }
  collapseListeners.forEach((listener) => listener());
}

function subscribeCollapsed(callback: () => void) {
  collapseListeners.push(callback);
  return () => {
    collapseListeners = collapseListeners.filter((l) => l !== callback);
  };
}

function getCollapsedSnapshot() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

function getCollapsedServerSnapshot() {
  return false;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );
  const setCollapsed = (value: boolean | ((prev: boolean) => boolean)) =>
    setCollapsedStore(typeof value === "function" ? value(getCollapsedSnapshot()) : value);
  const groups = visibleGroups(session?.user?.role as string | undefined);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.filter((g) => isGroupActive(g, pathname)).map((g) => g.key))
  );

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openGroup(key: string) {
    if (collapsed) setCollapsed(false);
    setExpanded((prev) => new Set(prev).add(key));
  }

  return (
    <nav
      className={`flex h-screen shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-150 ${
        collapsed ? "w-16" : "w-72"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 bg-black px-3">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:opacity-80"
            title="Expand menu"
          >
            <JarsLogo size={40} />
          </button>
        ) : (
          <>
            <Link href="/" className="shrink-0" title="Home">
              <JarsLogo size={40} />
            </Link>
            <span className="min-w-0 flex-1 leading-tight">
              <span
                className="block truncate whitespace-nowrap text-[13px] font-black tracking-tight text-white"
                title="JARS Cannabis Arizona"
              >
                JARS Cannabis Arizona
              </span>
              <span className="block truncate text-[9px] font-semibold tracking-[0.1em] text-white/60">
                CONSUMABLE MANAGEMENT
              </span>
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              title="Collapse menu"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => {
          const Icon = group.icon;
          const active = isGroupActive(group, pathname);
          const isOpen = expanded.has(group.key);

          if (group.href) {
            return (
              <Link
                key={group.key}
                href={group.href}
                title={collapsed ? group.label : undefined}
                className={`mx-2 my-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium ${
                  active
                    ? "bg-[#e5f3e5] text-[#0e3020]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{group.label}</span>}
              </Link>
            );
          }

          return (
            <div key={group.key}>
              <button
                type="button"
                title={collapsed ? group.label : undefined}
                onClick={() =>
                  collapsed ? openGroup(group.key) : toggleGroup(group.key)
                }
                className={`mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium ${
                  active && (collapsed || !isOpen)
                    ? "bg-[#eef6f0] text-[#0e3020]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{group.label}</span>
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </>
                )}
              </button>

              {!collapsed && isOpen && (
                <div className="ml-[1.85rem] border-l border-gray-200 pl-3">
                  {group.children?.map((leaf) => {
                    const leafActive = pathname.startsWith(leaf.href);
                    return (
                      <Link
                        key={leaf.href}
                        href={leaf.href}
                        className={`my-0.5 block rounded-md px-2.5 py-1.5 text-sm ${
                          leafActive
                            ? "bg-[#e5f3e5] font-medium text-[#0e3020]"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {leaf.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {session?.user && (
        <div className="shrink-0 border-t border-gray-200 p-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e5f3e5] text-xs font-semibold text-[#0e3020]">
              {session.user.name?.[0]?.toUpperCase() ?? session.user.email[0].toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {session.user.name || session.user.email}
                </p>
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
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
