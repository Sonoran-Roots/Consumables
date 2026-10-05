import { parse } from "csv-parse/sync";
import { squash } from "./lookup";

// The Inventory Audit module's own CSV helpers (it deliberately shares no
// code with Consumable Management's bulk import).

// A whole tracker tab is ~10,000 rows / ~2.5 MB. The byte cap sits under the
// 4 MB Server Action body limit (next.config.ts), which sits under Vercel's
// 4.5 MB request limit.
export const MAX_ROWS = 30000;
export const MAX_FILE_BYTES = 3.8 * 1024 * 1024;

export type Row = Record<string, string>;

// Headers are squashed ("Dept. 1" -> "dept1"), so spelling, case and
// punctuation in the sheet's header row don't matter.
export function parseCsv(text: string): { rows: Row[]; error?: string } {
  let rows: Row[];
  try {
    rows = parse(text, {
      bom: true,
      columns: (header: string[]) => header.map((h) => squash(h)),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (e) {
    return { rows: [], error: `Could not parse the file as CSV: ${(e as Error).message}` };
  }
  if (rows.length === 0) return { rows: [], error: "The file has no data rows." };
  if (rows.length > MAX_ROWS) {
    return { rows: [], error: `The file has ${rows.length} rows; the limit is ${MAX_ROWS} per upload.` };
  }
  return { rows };
}

// First non-empty value whose header equals one of `exact`, or starts with one
// of `prefix` (for long headers such as "Monitoring Action: Teams Notified (Do
// not pull on HUB)"). Names are given already squashed.
export function pick(row: Row, exact: string[], prefix: string[] = []): string {
  for (const key of Object.keys(row)) {
    const v = row[key]?.trim();
    if (!v) continue;
    if (exact.includes(key) || prefix.some((p) => key.startsWith(p))) return v;
  }
  return "";
}

export const hasColumn = (row: Row, exact: string[], prefix: string[] = []) =>
  Object.keys(row).some((k) => exact.includes(k) || prefix.some((p) => k.startsWith(p)));

// One quoted CSV cell. A value that starts with = + - @ (or a tab/CR) would be
// run as a formula by Excel, so it's prefixed with an apostrophe.
export const csvCell = (v: unknown): string => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const truthy = (v: string) => ["true", "yes", "y", "1", "x", "checked"].includes(v.trim().toLowerCase());
