import { parse } from "csv-parse/sync";

export const MAX_ROWS = 5000;
export const MAX_FILE_BYTES = 900 * 1024; // Server Actions cap request bodies at 1 MB

export type BulkResult = {
  checkOnly: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  notes: string[];
} | null;

export const DENIED: NonNullable<BulkResult> = {
  checkOnly: false,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: ["Only an admin can run bulk imports."],
  notes: [],
};

export function failure(message: string, checkOnly = false): NonNullable<BulkResult> {
  return { checkOnly, created: 0, updated: 0, skipped: 0, errors: [message], notes: [] };
}

// "Default Vendor", "defaultVendor" and "default_vendor" all become "defaultvendor".
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Row = Record<string, string>;

export function parseCsv(text: string): { rows: Row[]; error?: string } {
  let rows: Row[];
  try {
    rows = parse(text, {
      bom: true,
      columns: (header: string[]) => header.map((h) => normalize(h)),
      skip_empty_lines: true,
      trim: true,
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

// First non-empty value among the given header names (any spelling).
export function field(row: Row, ...names: string[]): string {
  for (const n of names) {
    const v = row[normalize(n)];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

// "" -> undefined (not provided), yes/true/1 -> true, no/false/0 -> false, anything else -> null (invalid).
export function parseBool(value: string): boolean | undefined | null {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (["yes", "y", "true", "1", "active"].includes(v)) return true;
  if (["no", "n", "false", "0", "inactive"].includes(v)) return false;
  return null;
}

export async function readUpload(
  formData: FormData
): Promise<{ text: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose a CSV file." };
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is over 900 KB — split it into smaller files and upload them one at a time." };
  }
  return { text: await file.text() };
}
