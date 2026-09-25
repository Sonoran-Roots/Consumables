"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MenuIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  DashboardIcon,
  BoxIcon,
  SwapIcon,
  CartIcon,
  GearIcon,
} from "./icons";
import type { ComponentType } from "react";

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
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );
  const setCollapsed = (value: boolean | ((prev: boolean) => boolean)) =>
    setCollapsedStore(typeof value === "function" ? value(getCollapsedSnapshot()) : value);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(GROUPS.filter((g) => isGroupActive(g, pathname)).map((g) => g.key))
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
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          title={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? (
            <MenuIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-gray-900">
            Sonoranroots Inventory
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
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
                    ? "bg-emerald-100 text-emerald-900"
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
                    ? "bg-emerald-50 text-emerald-900"
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
                            ? "bg-emerald-100 font-medium text-emerald-900"
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
    </nav>
  );
}
