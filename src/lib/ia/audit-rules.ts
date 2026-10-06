// The audit rules that need no database, so the counting screen (which runs in
// the browser) and the server share one definition. Nothing here may import
// the database or other server-only code.
import type { IaAuditType, IaLineStatus } from "@prisma/client";

// Exact match: any difference between the system and the physical count is a
// discrepancy. (Counts are floats, so compare with a hair of slack.)
export const isMismatch = (systemQty: number | null, actualQty: number | null): boolean =>
  systemQty !== null && actualQty !== null && Math.abs(systemQty - actualQty) > 1e-9;

export const fmtQty = (n: number | null, unit?: string | null) =>
  n === null ? "—" : `${Number.isInteger(n) ? n.toLocaleString("en-US") : String(Math.round(n * 1000) / 1000)}${unit ? ` ${unit}` : ""}`;

// The category picked by default when a count doesn't match, taken from the
// trackers' Key: count variances are AZDHS compliance; plant-count mismatches
// have their own entry.
export function defaultCategoryName(type: IaAuditType): string {
  return type === "PLANT" ? "Cultivation - Plant count does not match Dutchie" : "Variances between systematic and physical counts";
}

export type LineLike = {
  product: string | null; strain: string | null; batchId: string | null; pid: string | null; serialNo: string | null;
  position: number; unit: string | null; systemQty: number | null;
};

export const lineLabel = (l: LineLike) => l.product ?? l.strain ?? l.batchId ?? l.pid ?? l.serialNo ?? `line ${l.position}`;

export function describeDiscrepancy(l: LineLike, actualQty: number | null, note: string | null): string {
  const what = isMismatch(l.systemQty, actualQty)
    ? `system ${fmtQty(l.systemQty, l.unit)}, counted ${fmtQty(actualQty, l.unit)}`
    : "problem flagged during audit";
  return `${lineLabel(l)} — ${what}${note ? `. ${note}` : ""}`;
}

// One audit line as the counting screen sees it.
export type LineView = {
  id: string;
  position: number;
  product: string | null; batchId: string | null; pid: string | null; strain: string | null;
  room: string | null; serialNo: string | null; unit: string | null; category: string | null;
  systemQty: number | null; actualQty: number | null;
  status: IaLineStatus; note: string | null;
  countedByName: string | null; countedAt: string | null;
  findingId: string | null; findingStatus: string | null;
  version: string; // changes on every save
};
