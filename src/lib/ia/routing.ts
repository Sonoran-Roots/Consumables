// Who a finding is routed to. A finding goes to:
//   - the person it is assigned to directly, and
//   - every manager with a coverage rule that matches it.
// A rule names a facility, a department, or both; a rule with both only
// matches findings that satisfy both ("Fulfillment at McDowell Hub"). A
// department matches a finding's first or second department.
//
// The same rules also decide what a MANAGER may see at all, so they exist
// twice — in memory (ruleMatches, for building emails) and as a database
// filter (visibleWhere, for queries). Both are tested against each other.
import type { Prisma } from "@prisma/client";

export type CoverageRule = { userId: string; facilityId: string | null; departmentId: string | null };
export type RoutableFinding = {
  facilityId: string;
  departmentId: string;
  secondDepartmentId: string | null;
  assignedToId: string | null;
};

export function ruleMatches(rule: CoverageRule, f: RoutableFinding): boolean {
  if (!rule.facilityId && !rule.departmentId) return false; // an empty rule matches nothing, never everything
  if (rule.facilityId && rule.facilityId !== f.facilityId) return false;
  if (rule.departmentId && rule.departmentId !== f.departmentId && rule.departmentId !== f.secondDepartmentId) return false;
  return true;
}

export function recipientsFor(f: RoutableFinding, rules: CoverageRule[]): string[] {
  const ids = new Set<string>();
  if (f.assignedToId) ids.add(f.assignedToId);
  for (const r of rules) if (ruleMatches(r, f)) ids.add(r.userId);
  return [...ids];
}

// Splits findings into one list per person they're routed to (a finding with
// two recipients appears in both lists), plus the ones nobody is routed to.
export function groupByRecipient<T extends RoutableFinding>(
  findings: T[],
  rules: CoverageRule[]
): { byRecipient: Map<string, T[]>; unrouted: T[] } {
  const byRecipient = new Map<string, T[]>();
  const unrouted: T[] = [];
  for (const f of findings) {
    const ids = recipientsFor(f, rules);
    if (ids.length === 0) unrouted.push(f);
    for (const id of ids) byRecipient.set(id, [...(byRecipient.get(id) ?? []), f]);
  }
  return { byRecipient, unrouted };
}

function ruleWhere(rule: CoverageRule): Prisma.IaFindingWhereInput | null {
  if (!rule.facilityId && !rule.departmentId) return null;
  const parts: Prisma.IaFindingWhereInput[] = [];
  if (rule.facilityId) parts.push({ facilityId: rule.facilityId });
  if (rule.departmentId) parts.push({ OR: [{ departmentId: rule.departmentId }, { secondDepartmentId: rule.departmentId }] });
  return { AND: parts };
}

// The findings one manager may see: assigned to them, or matching any of their rules.
export function visibleWhere(userId: string, rules: CoverageRule[]): Prisma.IaFindingWhereInput {
  const own = rules.filter((r) => r.userId === userId).map(ruleWhere).filter((w): w is Prisma.IaFindingWhereInput => w !== null);
  return { OR: [{ assignedToId: userId }, ...own] };
}
