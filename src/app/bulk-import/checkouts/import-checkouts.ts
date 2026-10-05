import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { field, parseCsv, failure, type BulkResult } from "../csv";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const normName = (s: string) => s.replace(/\s+/g, " ").trim();

// "2026-02-30" matches the pattern but isn't a day that exists; toISOString()
// would throw on an invalid Date, so compare the parts instead.
function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

type EventDraft = {
  date: string;
  siteId: string;
  employeeKey: string;
  isReturn: boolean;
  purpose: string | null;
  department: string | null;
  notes: string | null;
  lines: { itemId: string; quantity: number }[];
};

// All-or-nothing on purpose: if any row is wrong, nothing is saved. A partly
// applied month of check-outs is hard to untangle, and re-uploading a corrected
// file would double-count whichever rows had gone through the first time.
export async function runCheckoutsImport(
  text: string,
  opts: { checkOnly: boolean; createEmployees: boolean }
): Promise<NonNullable<BulkResult>> {
  const { rows, error } = parseCsv(text);
  if (error) return failure(error, opts.checkOnly);

  const [sites, items, employees] = await Promise.all([
    db.site.findMany({ include: { book: true } }),
    db.item.findMany({ select: { id: true, name: true, sku: true } }),
    db.employee.findMany({ select: { id: true, name: true } }),
  ]);

  const siteByCode = new Map(sites.map((s) => [s.code.toLowerCase(), s]));
  const sitesByName = new Map<string, typeof sites>();
  for (const s of sites) {
    const k = s.name.toLowerCase();
    sitesByName.set(k, [...(sitesByName.get(k) ?? []), s]);
  }
  const itemByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
  const itemBySku = new Map(items.filter((i) => i.sku).map((i) => [i.sku!.toLowerCase(), i]));
  const employeesByName = new Map<string, typeof employees>();
  for (const e of employees) {
    const k = normName(e.name).toLowerCase();
    employeesByName.set(k, [...(employeesByName.get(k) ?? []), e]);
  }

  const errors: string[] = [];
  const events = new Map<string, EventDraft>();
  const newEmployees = new Map<string, { name: string; siteId: string }>(); // key -> person to create
  const todayIso = new Date().toISOString().slice(0, 10);
  let lineCount = 0;
  let unitCount = 0;
  let firstDate = "";
  let lastDate = "";

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const problems: string[] = [];

    const date = field(row, "date", "checkoutDate", "occurredAt");
    if (!ISO_DATE.test(date) || !isRealDate(date)) {
      problems.push(`date "${date}" must be a real date as YYYY-MM-DD`);
    } else if (date > todayIso) {
      problems.push(`date ${date} is in the future`);
    } else if (date < "2020-01-01") {
      problems.push(`date ${date} looks too old — check the year`);
    }

    const siteRaw = field(row, "site", "siteName");
    let site: (typeof sites)[number] | undefined = siteByCode.get(siteRaw.toLowerCase());
    if (!site && siteRaw) {
      const matches = sitesByName.get(siteRaw.toLowerCase()) ?? [];
      if (matches.length === 1) site = matches[0];
      else if (matches.length > 1) {
        problems.push(`site "${siteRaw}" exists in more than one book — use the site code (e.g. "${matches[0].code}")`);
      }
    }
    if (!site && !problems.some((p) => p.startsWith("site"))) {
      problems.push(siteRaw ? `no site named or coded "${siteRaw}"` : "site is required");
    }

    const itemRaw = field(row, "item", "itemName", "sku");
    const item = itemByName.get(itemRaw.toLowerCase()) ?? itemBySku.get(itemRaw.toLowerCase());
    if (!item) problems.push(itemRaw ? `no item named or with SKU "${itemRaw}"` : "item is required");

    const qtyRaw = field(row, "quantity", "qty");
    const quantity = Number(qtyRaw);
    if (!qtyRaw || !Number.isFinite(quantity) || quantity <= 0) {
      problems.push(`quantity "${qtyRaw}" must be a number greater than zero`);
    }

    const typeRaw = field(row, "type").toLowerCase();
    let isReturn = false;
    if (typeRaw === "return" || typeRaw === "returned") isReturn = true;
    else if (typeRaw && typeRaw !== "checkout" && typeRaw !== "out") {
      problems.push(`type "${typeRaw}" should be checkout or return (or blank for checkout)`);
    }

    const employeeRaw = normName(field(row, "employee", "employeeName", "checkedOutBy"));
    const employeeKey = employeeRaw.toLowerCase();
    if (!employeeRaw) {
      problems.push("employee is required");
    } else {
      const matches = employeesByName.get(employeeKey) ?? [];
      if (matches.length > 1) {
        problems.push(`employee "${employeeRaw}" matches ${matches.length} people — make the name unique on the Employees page first`);
      } else if (matches.length === 0) {
        if (opts.createEmployees && site) {
          if (!newEmployees.has(employeeKey)) newEmployees.set(employeeKey, { name: employeeRaw, siteId: site.id });
        } else if (!opts.createEmployees) {
          problems.push(`employee "${employeeRaw}" not found — add them on the Employees page, or tick "Create employees that don't exist yet"`);
        }
      }
    }

    if (problems.length > 0 || !site || !item) {
      errors.push(`Row ${rowNum}: ${problems.join("; ")}.`);
      return;
    }

    const purpose = field(row, "purpose") || null;
    const department = field(row, "department") || null;
    const notes = field(row, "notes") || null;
    const key = [date, site.id, employeeKey, isReturn, purpose, department, notes].join("\u0001");
    let ev = events.get(key);
    if (!ev) {
      ev = { date, siteId: site.id, employeeKey, isReturn, purpose, department, notes, lines: [] };
      events.set(key, ev);
    }
    ev.lines.push({ itemId: item.id, quantity });
    lineCount++;
    unitCount += quantity;
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
  });

  if (errors.length > 0) {
    return {
      checkOnly: opts.checkOnly,
      created: 0,
      updated: 0,
      skipped: 0,
      errors,
      notes: ["Nothing was saved. Fix the problems below, then upload the whole file again."],
    };
  }

  const notes = [
    `${events.size} check-out event${events.size === 1 ? "" : "s"} with ${lineCount} item line${lineCount === 1 ? "" : "s"} (${unitCount.toLocaleString("en-US")} units), dated ${firstDate}${lastDate !== firstDate ? ` to ${lastDate}` : ""}.`,
  ];
  if (newEmployees.size > 0) {
    const names = [...newEmployees.values()].map((e) => e.name);
    notes.push(
      `${opts.checkOnly ? "Would create" : "Created"} ${names.length} employee${names.length === 1 ? "" : "s"} with no PIN or login: ${names.slice(0, 10).join(", ")}${names.length > 10 ? `, and ${names.length - 10} more` : ""}.`
    );
  }
  notes.push("Uploading the same file again records these check-outs a second time.");

  const result: NonNullable<BulkResult> = {
    checkOnly: opts.checkOnly,
    created: events.size,
    updated: 0,
    skipped: 0,
    errors: [],
    notes,
  };
  if (opts.checkOnly || events.size === 0) return result;

  // Build everything with our own ids so events, lines and ledger rows can be
  // written in a handful of bulk inserts, all inside one transaction.
  const employeeIdByKey = new Map<string, string>();
  for (const [k, list] of employeesByName) if (list.length === 1) employeeIdByKey.set(k, list[0].id);
  const employeeRows: Prisma.EmployeeCreateManyInput[] = [];
  for (const [k, e] of newEmployees) {
    const id = randomUUID();
    employeeIdByKey.set(k, id);
    employeeRows.push({ id, name: e.name, siteId: e.siteId });
  }

  const eventRows: Prisma.CheckoutEventCreateManyInput[] = [];
  const lineRows: Prisma.CheckoutLineCreateManyInput[] = [];
  const txRows: Prisma.InventoryTransactionCreateManyInput[] = [];
  for (const ev of events.values()) {
    const id = randomUUID();
    const employeeId = employeeIdByKey.get(ev.employeeKey)!;
    const occurredAt = new Date(`${ev.date}T12:00:00Z`);
    eventRows.push({
      id, siteId: ev.siteId, employeeId, occurredAt,
      purpose: ev.purpose, department: ev.department, notes: ev.notes, isReturn: ev.isReturn,
    });
    for (const l of ev.lines) {
      lineRows.push({ checkoutEventId: id, itemId: l.itemId, quantity: l.quantity });
      txRows.push({
        itemId: l.itemId,
        siteId: ev.siteId,
        type: ev.isReturn ? "CHECKOUT_RETURN" : "CHECKOUT",
        quantity: ev.isReturn ? l.quantity : -l.quantity,
        checkoutEventId: id,
        employeeId,
        occurredAt,
      });
    }
  }

  try {
    await db.$transaction([
      db.employee.createMany({ data: employeeRows }),
      db.checkoutEvent.createMany({ data: eventRows }),
      db.checkoutLine.createMany({ data: lineRows }),
      db.inventoryTransaction.createMany({ data: txRows }),
    ]);
  } catch (e) {
    return failure(`Nothing was saved — the database rejected the batch: ${(e as Error).message}`);
  }
  return result;
}
