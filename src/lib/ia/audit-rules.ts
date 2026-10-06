// The audit rules that need no database, so the counting screen (which runs in
// the browser) and the server share one definition. Nothing here may import
// the database or other server-only code.
import type { IaLineStatus } from "@prisma/client";

// Exact match: any difference between the system and the physical count is a
// discrepancy. (Counts are floats, so compare with a hair of slack.)
export const isMismatch = (systemQty: number | null, actualQty: number | null): boolean =>
  systemQty !== null && actualQty !== null && Math.abs(systemQty - actualQty) > 1e-9;

export const fmtQty = (n: number | null, unit?: string | null) =>
  n === null ? "—" : `${Number.isInteger(n) ? n.toLocaleString("en-US") : String(Math.round(n * 1000) / 1000)}${unit ? ` ${unit}` : ""}`;

// ---------------------------------------------------------------------------
// What can be wrong with an item
// ---------------------------------------------------------------------------

export type FlagField =
  | "COUNT" | "PRODUCT" | "BATCH" | "PID" | "STRAIN" | "HARVEST_DATE" | "EXPIRATION_DATE" | "MANUFACTURE_DATE"
  | "UNIT" | "TAG" | "ROOM" | "STATUS" | "LABEL_MISSING" | "LABEL_UNREADABLE" | "OTHER";

export type LineFields = {
  product: string | null; batchId: string | null; pid: string | null; strain: string | null; serialNo: string | null;
  unit: string | null; room: string | null; itemStatus: string | null;
  harvestDate: string | null; expirationDate: string | null; manufactureDate: string | null;
};

type FieldDef = {
  key: FlagField;
  label: string;
  // What the system (the Dutchie export) says; undefined for problems that aren't about one value.
  read?: (l: LineFields) => string | null;
  // The standard finding category (by name, from the trackers' Key) and where the correction is made.
  category: string | null;
  target: "SYSTEM" | "LABEL";
};

const LABEL_INFO = "Incorrect information on label - license, batch, PID, batch #, and weight/qty.";

export const FIELD_DEFS: FieldDef[] = [
  { key: "COUNT", label: "Count", category: "Variances between systematic and physical counts", target: "SYSTEM" },
  { key: "PRODUCT", label: "Product name", read: (l) => l.product, category: LABEL_INFO, target: "LABEL" },
  { key: "BATCH", label: "Batch ID", read: (l) => l.batchId, category: LABEL_INFO, target: "LABEL" },
  { key: "PID", label: "Package ID (PID)", read: (l) => l.pid, category: LABEL_INFO, target: "LABEL" },
  { key: "STRAIN", label: "Strain", read: (l) => l.strain, category: "Product name does not match strain name", target: "LABEL" },
  { key: "HARVEST_DATE", label: "Harvest date", read: (l) => l.harvestDate, category: "Missing/incorrect harvest date or expiration date", target: "LABEL" },
  { key: "EXPIRATION_DATE", label: "Expiration date", read: (l) => l.expirationDate, category: "Missing/incorrect harvest date or expiration date", target: "LABEL" },
  { key: "MANUFACTURE_DATE", label: "Date of manufacture", read: (l) => l.manufactureDate, category: "Missing/incorrect harvest date or expiration date", target: "LABEL" },
  { key: "UNIT", label: "Unit", read: (l) => l.unit, category: LABEL_INFO, target: "LABEL" },
  { key: "TAG", label: "Tag", read: (l) => l.serialNo, category: "Wrong #tag - Needs updating", target: "SYSTEM" },
  { key: "ROOM", label: "Room", read: (l) => l.room, category: "Wrong room - Needs updating", target: "SYSTEM" },
  { key: "STATUS", label: "Status", read: (l) => l.itemStatus, category: "Wrong status - Needs updating", target: "SYSTEM" },
  { key: "LABEL_MISSING", label: "Label missing", category: "Unlabeled product (Inventory label completely missing)", target: "LABEL" },
  { key: "LABEL_UNREADABLE", label: "Label unreadable", category: LABEL_INFO, target: "LABEL" },
  { key: "OTHER", label: "Something else", category: null, target: "SYSTEM" },
];

export const fieldDef = (key: string | null | undefined): FieldDef | undefined => FIELD_DEFS.find((f) => f.key === key);
export const fieldLabel = (key: string | null | undefined) => fieldDef(key)?.label ?? "Issue";

// The label details an auditor checks, in the order shown on screen. Each has
// a value in the export (a blank one is shown as "—", and can still be flagged
// if the label says something).
export const LABEL_CHECK_FIELDS: FlagField[] = ["PRODUCT", "STRAIN", "BATCH", "PID", "TAG", "HARVEST_DATE", "EXPIRATION_DATE", "MANUFACTURE_DATE", "UNIT", "ROOM", "STATUS"];
// Problems with the label as a whole.
export const WHOLE_LABEL_ISSUES: FlagField[] = ["LABEL_MISSING", "LABEL_UNREADABLE", "OTHER"];

export type LineLike = LineFields & { position: number; systemQty: number | null };

export const lineLabel = (l: Pick<LineLike, "product" | "strain" | "batchId" | "pid" | "serialNo" | "position">) =>
  l.product ?? l.strain ?? l.batchId ?? l.pid ?? l.serialNo ?? `line ${l.position}`;

// The finding's headline, e.g. "Canamo Shatter — Harvest date: system 2025-08-06, label shows 2025-08-05".
export function describeIssue(l: LineLike, field: FlagField, foundValue: string | null, actualQty: number | null, note: string | null): string {
  let what: string;
  if (field === "COUNT") {
    what = `Count: system ${fmtQty(l.systemQty, l.unit)}, counted ${fmtQty(actualQty, l.unit)}`;
  } else if (field === "LABEL_MISSING" || field === "LABEL_UNREADABLE" || field === "OTHER") {
    what = fieldLabel(field);
  } else {
    const sys = fieldDef(field)?.read?.(l);
    what = `${fieldLabel(field)}: system ${sys ? `“${sys}”` : "blank"}, label shows ${foundValue ? `“${foundValue}”` : "nothing"}`;
  }
  return `${lineLabel(l)} — ${what}${note ? `. ${note}` : ""}`;
}

// ---------------------------------------------------------------------------
// Adjustments: what has to change because of a finding
// ---------------------------------------------------------------------------

export type AdjustmentTarget = "SYSTEM" | "LABEL" | "BOTH";

export const defaultTarget = (field: string | null): AdjustmentTarget => fieldDef(field)?.target ?? "SYSTEM";

export function describeAdjustment(f: {
  flaggedField: string | null; systemValue: string | null; foundValue: string | null; unit: string | null; target: AdjustmentTarget | null;
}): string {
  const target = f.target ?? defaultTarget(f.flaggedField);
  if (f.flaggedField === "COUNT") {
    const sys = Number(f.systemValue), found = Number(f.foundValue);
    if (Number.isFinite(sys) && Number.isFinite(found)) {
      const diff = Math.round((found - sys) * 1000) / 1000;
      return `Adjust quantity in Dutchie: ${fmtQty(sys, f.unit)} → ${fmtQty(found, f.unit)} (${diff > 0 ? "+" : ""}${fmtQty(diff, f.unit)})`;
    }
    return "Adjust the quantity in Dutchie to the counted amount";
  }
  if (f.flaggedField === "LABEL_MISSING") return "Print and apply a new label";
  if (f.flaggedField === "LABEL_UNREADABLE") return "Reprint the label";
  if (f.flaggedField === "OTHER" || !f.flaggedField) return "See the finding's notes";

  const name = fieldLabel(f.flaggedField);
  const sys = f.systemValue ? `“${f.systemValue}”` : "blank";
  const found = f.foundValue ? `“${f.foundValue}”` : "blank";
  const inDutchie = `Update ${name} in Dutchie: ${sys} → ${found}`;
  const onLabel = `Correct the label's ${name}: it shows ${found}, the system says ${sys}`;
  return target === "SYSTEM" ? inDutchie : target === "LABEL" ? onLabel : `${inDutchie}; ${onLabel.charAt(0).toLowerCase()}${onLabel.slice(1)}`;
}

// ---------------------------------------------------------------------------
// One audit line as the counting screen sees it
// ---------------------------------------------------------------------------

export type LineIssueView = {
  id: string;
  field: FlagField;
  systemValue: string | null;
  foundValue: string | null;
  note: string | null;
  status: string;
  foundAt: string;
  reviewed: boolean;
};

export type LineView = {
  id: string;
  position: number;
  product: string | null; batchId: string | null; pid: string | null; strain: string | null;
  room: string | null; serialNo: string | null; unit: string | null; category: string | null;
  itemStatus: string | null; harvestDate: string | null; expirationDate: string | null; manufactureDate: string | null;
  systemQty: number | null; allocatedQty: number | null; actualQty: number | null;
  status: IaLineStatus; labelVerified: boolean; note: string | null;
  countedByName: string | null; countedAt: string | null;
  issues: LineIssueView[];
  version: string; // changes on every save
};
