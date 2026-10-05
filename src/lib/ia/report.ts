import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { parseFlexibleDate } from "./dates";
import { visibleWhere } from "./routing";

export type ReportFilters = {
  from: Date;
  to: Date;
  facilityId: string;
  departmentId: string;
  typeId: string;
  routedTo: string;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

// Default period: the current month so far (what a month-end report covers).
export function readReportFilters(sp: Params, now = new Date()): ReportFilters {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
  return {
    from: parseFlexibleDate(one(sp.from)) ?? monthStart,
    to: parseFlexibleDate(one(sp.to)) ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)),
    facilityId: one(sp.facility),
    departmentId: one(sp.department),
    typeId: one(sp.type),
    routedTo: one(sp.manager),
  };
}

// The filters other than the date range (shared by the period summary, the
// needs-attention list and the CSV export).
export async function baseWhere(f: ReportFilters, canViewAs: boolean): Promise<Prisma.IaFindingWhereInput> {
  const parts: Prisma.IaFindingWhereInput[] = [];
  if (f.facilityId) parts.push({ facilityId: f.facilityId });
  if (f.departmentId) parts.push({ OR: [{ departmentId: f.departmentId }, { secondDepartmentId: f.departmentId }] });
  if (f.typeId) parts.push({ findingTypeId: f.typeId });
  // The inventory team can look at the report the way a given manager sees it.
  if (canViewAs && f.routedTo) {
    const rules = await db.iaCoverage.findMany({ where: { userId: f.routedTo } });
    parts.push(visibleWhere(f.routedTo, rules));
  }
  return { AND: parts };
}

export const inPeriod = (f: ReportFilters): Prisma.IaFindingWhereInput => ({ auditDate: { gte: f.from, lte: f.to } });
