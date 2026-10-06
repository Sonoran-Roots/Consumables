// Reads an uploaded audit file — the list of lines to count — into audit lines.
// Pure (no database), so it can be tested on its own. Columns are the
// trackers' own: Product, Batch, PID, Strain, Room, Serial No, Unit/Type,
// Category and the system count (Qty (Inc. allocated), Count, Dutchie,
// Available, ...). Header spelling, case and punctuation don't matter.
import { parse } from "csv-parse/sync";
import { MAX_ROWS, pick, type Row } from "./csv";
import { squash } from "./lookup";
import { parseDutchieDateTime, parseFlexibleDate, toDateInput } from "./dates";

export type ParsedLine = {
  position: number;
  product: string | null;
  batchId: string | null;
  pid: string | null;
  strain: string | null;
  room: string | null;
  serialNo: string | null;
  unit: string | null;
  category: string | null;
  itemStatus: string | null;
  harvestDate: string | null;
  expirationDate: string | null;
  manufactureDate: string | null;
  allocatedQty: number | null;
  systemQty: number | null;
  dutchieId: string | null; // Id column of Dutchie's audit table
  brand: string | null;
};

// Dates on a label are compared as text, so a recognisable date is normalised
// to YYYY-MM-DD (the export and the label are then compared like for like);
// anything else is kept exactly as written.
const dateText = (raw: string): string | null => {
  if (!raw) return null;
  const d = parseFlexibleDate(raw);
  return d ? toDateInput(d) : raw;
};

export type ParsedAudit = {
  lines: ParsedLine[];
  skippedHeaders: number; // section/month header rows and blanks that aren't auditable lines
  error?: string;
};

// "1,158" -> 1158, "177.6 g" -> 177.6 (+ unit "g"), "" / "n/a" -> null.
export function readQuantity(raw: string): { value: number | null; unit: string | null } {
  const m = /^\s*(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]+)?\s*$/.exec(raw);
  if (!m) return { value: null, unit: null };
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? { value, unit: m[2] ?? null } : { value: null, unit: null };
}

// Several columns can hold a count (the product tabs have both "Available" and
// "Qty (Inc. allocated)"); the first group with a value wins, most specific first.
const QTY_GROUPS: { exact: string[]; prefix: string[] }[] = [
  { exact: [], prefix: ["qtyinc"] },
  { exact: ["expectedqty", "systemqty", "system", "dutchie", "count", "quantity", "qty"], prefix: [] },
  { exact: ["available"], prefix: [] },
];

function systemQuantity(row: Row): { value: number | null; unit: string | null } {
  for (const g of QTY_GROUPS) {
    const raw = pick(row, g.exact, g.prefix);
    if (raw) {
      const q = readQuantity(raw);
      if (q.value !== null) return q;
    }
  }
  return { value: null, unit: null };
}

// Header names we recognise, squashed. The trackers' room tabs have a title row
// ("Clone Room Audit Date: 1") above the real column headers, so the header row
// is found by looking for the first row (within the top 15) that has at least
// two of these.
const KNOWN_HEADERS = new Set([
  "product", "productname", "item", "batch", "batchid", "harvestbatch", "pid", "strain", "serialno", "serial", "serialnumber",
  "tags", "tag", "room", "location", "unit", "uom", "type", "category", "count", "qty", "quantity", "dutchie", "available",
  "systemqty", "system", "actual", "subroom", "stage", "harvestdate", "expirationdate", "packageid", "expectedqty", "countedqty", "brand",
]);
const isKnownHeader = (h: string) => KNOWN_HEADERS.has(h) || h.startsWith("qtyinc");

// Raw table -> rows keyed by squashed header. Skips everything above the
// header row, and any later row that just repeats the headers (the trackers
// repeat them above each section). When two columns share a name (the flower
// tab has two "Strain" columns) the first one with a value wins.
export function readTable(text: string): { rows: Row[]; error?: string } {
  let table: string[][];
  try {
    table = parse(text, { bom: true, columns: false, skip_empty_lines: true, trim: true, relax_column_count: true });
  } catch (e) {
    return { rows: [], error: `Could not parse the file as CSV: ${(e as Error).message}` };
  }
  const headerAt = table.slice(0, 15).findIndex((r) => r.filter((c) => isKnownHeader(squash(c))).length >= 2);
  if (headerAt < 0) {
    return { rows: [], error: "Couldn't find the column headers. The file needs a header row with names like Product, Batch, PID, Strain, Room, Serial No and a count column." };
  }
  const headers = table[headerAt].map(squash);
  const body = table.slice(headerAt + 1);
  if (body.length > MAX_ROWS) return { rows: [], error: `The file has ${body.length} rows; the limit is ${MAX_ROWS} per upload.` };

  const rows: Row[] = [];
  for (const cells of body) {
    const repeatsHeader = cells.filter((c, i) => headers[i] && squash(c) === headers[i]).length >= 2;
    if (repeatsHeader) continue;
    const row: Row = {};
    headers.forEach((h, i) => {
      if (h && cells[i] && !row[h]) row[h] = cells[i];
    });
    rows.push(row);
  }
  return { rows };
}

export function parseAuditLines(text: string): ParsedAudit {
  const { rows, error } = readTable(text);
  if (error) return { lines: [], skippedHeaders: 0, error };

  const lines: ParsedLine[] = [];
  let skippedHeaders = 0;
  for (const row of rows) {
    const product = pick(row, ["product", "productname", "item"]) || null;
    const strain = pick(row, ["strain"]) || null;
    const batchId = pick(row, ["batch", "batchid", "harvestbatch"]) || null;
    const pid = pick(row, ["pid", "packageid"]) || null;
    const serialNo = pick(row, ["serialno", "serial", "serialnumber", "tags", "tag"]) || null;
    const qty = systemQuantity(row);

    // A line you can actually count has something to identify it or a count to
    // compare. Rows with only a name ("Q1", "January", "Post Production 1&2")
    // are the trackers' section headings.
    if (!batchId && !pid && !serialNo && qty.value === null) {
      skippedHeaders++;
      continue;
    }
    lines.push({
      position: lines.length + 1,
      product, strain, batchId, pid, serialNo,
      room: pick(row, ["room", "location"]) || null,
      unit: pick(row, ["unit", "uom", "type"]) || qty.unit,
      category: pick(row, ["category"]) || null,
      itemStatus: pick(row, ["status", "itemstatus"]) || null,
      harvestDate: dateText(pick(row, ["harvestdate", "harvested"])),
      expirationDate: dateText(pick(row, ["expirationdate", "expiration", "expiry", "expirydate"])),
      manufactureDate: dateText(pick(row, ["dateofmanufacture", "manufacturedate", "manufactured"])),
      allocatedQty: readQuantity(pick(row, ["allocatedqty", "allocated"])).value,
      systemQty: qty.value,
      dutchieId: pick(row, ["id"]) || null,
      brand: pick(row, ["brand"]) || null,
    });
  }
  if (lines.length === 0) {
    return { lines, skippedHeaders, error: "No auditable lines found — each line needs at least a batch, PID, serial number or a count." };
  }
  return { lines, skippedHeaders };
}

// ---------------------------------------------------------------------------
// The completed table: counts, the time they were counted, notes and reasons
// ---------------------------------------------------------------------------

export type CompletedRow = {
  rowNumber: number;
  dutchieId: string | null;
  pid: string | null;
  product: string | null;
  expectedQty: number | null;
  countedQty: number | null;
  countedOn: Date | null;
  note: string | null;
  reason: string | null;
};

// The same table Dutchie exports at the start of an audit, after the counts
// (and, for discrepancies, the adjustment reasons) have been filled in.
export function parseCompletedTable(text: string): { rows: CompletedRow[]; error?: string } {
  const { rows, error } = readTable(text);
  if (error) return { rows: [], error };
  const out: CompletedRow[] = [];
  rows.forEach((row, i) => {
    const dutchieId = pick(row, ["id"]) || null;
    const pid = pick(row, ["pid", "packageid"]) || null;
    if (!dutchieId && !pid) return; // blank or heading row
    const on = pick(row, ["countedon"]);
    out.push({
      rowNumber: i + 2,
      dutchieId, pid,
      product: pick(row, ["productname", "product"]) || null,
      expectedQty: readQuantity(pick(row, ["expectedqty"])).value,
      countedQty: readQuantity(pick(row, ["countedqty"])).value,
      countedOn: on ? parseDutchieDateTime(on) : null,
      note: pick(row, ["note", "notes"]) || null,
      reason: pick(row, ["adjustmentreason", "reason"]) || null,
    });
  });
  if (out.length === 0) return { rows: [], error: "No rows found — the file needs the Dutchie audit table's columns (Id or Package ID, Counted Qty…)." };
  return { rows: out };
}
