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
  { prefix: "/bulk-import", role: "ADMIN" },
  { prefix: "/import", role: "ADMIN" }, // old URL; redirects to /bulk-import/inventory
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
];

export function minRoleFor(pathname: string): StaffRole {
  const match = ROUTE_MIN_ROLE.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix)
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.role ?? "USER";
}

// ---------------------------------------------------------------------------
// Modules. The app is two separate modules that share only logins and the
// admin console (Employees page):
//   - Consumable Management: everything at the root (/inventory, /items, ...).
//     Access = User.isPurchasingTeam, at level User.role (StaffRole above).
//   - Inventory Audit: everything under /inventory-audit.
//     Access = User.auditRole (null means no access).
// Kiosk tablets are neither: they only ever reach /kiosk.
// ---------------------------------------------------------------------------

export type AuditRole = "AUDITOR" | "MANAGER" | "ADMIN";
export const AUDIT_ROLES: AuditRole[] = ["AUDITOR", "MANAGER", "ADMIN"];

// /inventory-audit, not /audit: the consumables side already has /audits, and
// prefix checks would otherwise confuse the two.
export const AUDIT_PREFIX = "/inventory-audit";

export type ModuleKey = "CONSUMABLES" | "AUDIT";

export function isAuditRole(value: unknown): value is AuditRole {
  return typeof value === "string" && (AUDIT_ROLES as string[]).includes(value);
}

export function isAuditPath(pathname: string): boolean {
  return pathname === AUDIT_PREFIX || pathname.startsWith(`${AUDIT_PREFIX}/`);
}

export function modulesFor(user: {
  isPurchasingTeam?: boolean | null;
  auditRole?: string | null;
}): ModuleKey[] {
  const modules: ModuleKey[] = [];
  if (user.isPurchasingTeam) modules.push("CONSUMABLES");
  if (isAuditRole(user.auditRole)) modules.push("AUDIT");
  return modules;
}

export const MODULE_HOME: Record<ModuleKey, string> = {
  CONSUMABLES: "/",
  AUDIT: AUDIT_PREFIX,
};

export type AccessDecision = { allow: true } | { allow: false; to: string; denied?: boolean };

// The proxy's whole routing rule, kept pure so it can be tested exhaustively:
// which module a path belongs to, whether this user has that module, and
// whether their level reaches this route. (The proxy handles /kiosk and the
// signed-out case before it gets here.)
export function decideAccess(
  pathname: string,
  user: { role?: string | null; isPurchasingTeam?: boolean | null; auditRole?: string | null }
): AccessDecision {
  const hasConsumables = user.isPurchasingTeam === true;
  const auditRole = isAuditRole(user.auditRole) ? user.auditRole : null;

  // A login with no module can only use the kiosk.
  if (!hasConsumables && !auditRole) return { allow: false, to: "/kiosk" };

  if (pathname === "/modules") return { allow: true };

  if (isAuditPath(pathname)) {
    if (!auditRole) return { allow: false, to: "/", denied: true };
    if (!auditRolesAllowedFor(pathname).includes(auditRole)) {
      return { allow: false, to: AUDIT_PREFIX, denied: true };
    }
    return { allow: true };
  }

  // Consumable Management. An audit-only user never lands on its pages.
  if (!hasConsumables) return { allow: false, to: AUDIT_PREFIX };
  if (!roleAtLeast(user.role, minRoleFor(pathname))) return { allow: false, to: "/", denied: true };
  return { allow: true };
}

// Audit roles are capabilities, not a ladder (a manager follows up on
// findings but doesn't enter them; an auditor enters them but isn't someone
// findings get routed to), so each route lists exactly which roles may open
// it. Longest matching prefix wins; anything unlisted is open to all three.
const AUDIT_ROUTE_ROLES: { prefix: string; roles: AuditRole[] }[] = [
  { prefix: `${AUDIT_PREFIX}/settings`, roles: ["ADMIN"] },
  { prefix: `${AUDIT_PREFIX}/upload`, roles: ["AUDITOR", "ADMIN"] },
  { prefix: `${AUDIT_PREFIX}/findings/new`, roles: ["AUDITOR", "ADMIN"] },
  { prefix: `${AUDIT_PREFIX}/edit`, roles: ["AUDITOR", "ADMIN"] },
];

export function auditRolesAllowedFor(pathname: string): AuditRole[] {
  const match = AUDIT_ROUTE_ROLES.filter(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.roles ?? AUDIT_ROLES;
}
