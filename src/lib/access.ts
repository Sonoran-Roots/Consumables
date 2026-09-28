export type StaffRole = "USER" | "MANAGER" | "ADMIN";

const ROLE_RANK: Record<StaffRole, number> = { USER: 0, MANAGER: 1, ADMIN: 2 };

export function roleAtLeast(role: string | null | undefined, minimum: StaffRole): boolean {
  const rank = ROLE_RANK[(role as StaffRole) ?? "USER"] ?? 0;
  return rank >= ROLE_RANK[minimum];
}

// Longest matching prefix wins, so a more specific rule (e.g. the trailing
// slash on "/employees/" covering new/edit forms) overrides a shorter one
// (the plain "/employees" list view) regardless of list order. Anything not
// matched defaults to requiring only "USER" — i.e. any purchasing-team
// member, matching the current default matrix (Dashboard, Inventory, Items,
// Transfers, Checkouts, Audits, Reconciliation are all USER-tier).
const ROUTE_MIN_ROLE: { prefix: string; role: StaffRole }[] = [
  { prefix: "/reconciliation/finance-report", role: "ADMIN" },
  { prefix: "/import", role: "MANAGER" },
  { prefix: "/purchasing", role: "MANAGER" },
  { prefix: "/vendors", role: "MANAGER" },
  { prefix: "/employees/", role: "ADMIN" },
  { prefix: "/employees", role: "MANAGER" },
  { prefix: "/sites/", role: "ADMIN" },
  { prefix: "/sites", role: "MANAGER" },
  { prefix: "/books", role: "ADMIN" },
  { prefix: "/categories/", role: "ADMIN" },
  { prefix: "/categories", role: "MANAGER" },
  { prefix: "/units/", role: "ADMIN" },
  { prefix: "/units", role: "MANAGER" },
  { prefix: "/users", role: "ADMIN" },
];

export function minRoleFor(pathname: string): StaffRole {
  const match = ROUTE_MIN_ROLE.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix)
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.role ?? "USER";
}
