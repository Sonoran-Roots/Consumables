import { db } from "@/lib/db";
import { parse } from "csv-parse/sync";
import type { MaterialType, Prisma } from "@prisma/client";

export type ImportSummary = {
  newItems: number;
  newVendors: string[];
  rowsBySite: Record<string, number>;
  totalValue: number;
};

export type ImportResult = {
  successCount: number;
  errorCount: number;
  errors: string[];
  // Only set on a dry run: what a real run would create, with nothing written.
  summary?: ImportSummary;
};

const VALID_MATERIAL_TYPES = new Set(["DM", "IM", "PM", "MM", "AFS", "NA"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function runInventoryImport(
  text: string,
  // `assumeEmptyCatalog` (dry run only) validates as if no items existed yet,
  // for rehearsing a full cutover import before the catalog is actually cleared.
  opts: { dryRun?: boolean; assumeEmptyCatalog?: boolean } = {}
): Promise<ImportResult> {
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: (header: string[]) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    return {
      successCount: 0,
      errorCount: 0,
      errors: [`Could not parse the file as CSV: ${(e as Error).message}`],
    };
  }

  if (records.length === 0) {
    return { successCount: 0, errorCount: 0, errors: ["The file has no data rows."] };
  }

  const [categories, aliases, uoms, sites, existingItems, existingVendors] = await Promise.all([
    db.category.findMany(),
    db.legacyCategoryAlias.findMany(),
    db.unitOfMeasure.findMany(),
    db.site.findMany({ include: { book: true } }),
    opts.dryRun && opts.assumeEmptyCatalog ? Promise.resolve([]) : db.item.findMany(),
    opts.dryRun && opts.assumeEmptyCatalog ? Promise.resolve([]) : db.vendor.findMany(),
  ]);

  const vendorByName = new Map(existingVendors.map((v) => [v.name.toLowerCase(), v]));
  // Vendors named in the file that don't exist yet — created before the items
  // that reference them. Keyed by lowercase name, value is the display name.
  const newVendorNames = new Map<string, string>();
  // Each new item's default vendor is the vendor of its most recently received lot.
  const latestLotByItem = new Map<string, { date: string; vendorKey: string }>();

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const categoryIdByAlias = new Map(
    aliases.map((a) => [a.rawCategoryName.toLowerCase(), a.categoryId])
  );
  const uomByCode = new Map(uoms.map((u) => [u.code.toLowerCase(), u]));
  const itemByName = new Map(existingItems.map((i) => [i.name.toLowerCase(), i]));
  const sitesByName = new Map<string, typeof sites>();
  const siteByCode = new Map(sites.map((s) => [s.code.toLowerCase(), s]));
  for (const s of sites) {
    const key = s.name.toLowerCase();
    sitesByName.set(key, [...(sitesByName.get(key) ?? []), s]);
  }

  const errors: string[] = [];
  const newItemsToCreate = new Map<string, Prisma.ItemCreateInput>();
  const validRows: {
    itemName: string;
    siteId: string;
    siteName: string;
    quantity: number;
    unitCost: number | null;
    vendorKey: string | null;
    occurredAt: Date | null;
    notes: string | null;
  }[] = [];

  records.forEach((row, index) => {
    const rowNum = index + 2; // +1 for header row, +1 for 1-indexing
    const itemName = (row.itemName ?? "").trim();
    const siteNameOrCode = (row.site ?? row.siteName ?? "").trim();
    const quantityRaw = (row.quantity ?? "").trim();

    if (!itemName || !siteNameOrCode || !quantityRaw) {
      errors.push(`Row ${rowNum}: itemName, site, and quantity are all required.`);
      return;
    }

    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity)) {
      errors.push(`Row ${rowNum}: quantity "${quantityRaw}" is not a number.`);
      return;
    }

    let site = siteByCode.get(siteNameOrCode.toLowerCase());
    if (!site) {
      const matches = sitesByName.get(siteNameOrCode.toLowerCase()) ?? [];
      if (matches.length === 1) {
        site = matches[0];
      } else if (matches.length > 1) {
        errors.push(
          `Row ${rowNum}: site "${siteNameOrCode}" matches ${matches.length} sites (in ${matches
            .map((s) => s.book.code)
            .join(", ")}) — use the site code instead (e.g. "${matches[0].code}") to disambiguate.`
        );
        return;
      }
    }
    if (!site) {
      errors.push(`Row ${rowNum}: no site found named or coded "${siteNameOrCode}".`);
      return;
    }

    const unitCostRaw = (row.unitCost ?? "").trim();
    const unitCost = unitCostRaw ? Number(unitCostRaw) : null;
    if (unitCostRaw && !Number.isFinite(unitCost)) {
      errors.push(`Row ${rowNum}: unitCost "${unitCostRaw}" is not a number.`);
      return;
    }

    const receivedRaw = (row.receivedDate ?? row.date ?? "").trim();
    if (receivedRaw && !ISO_DATE.test(receivedRaw)) {
      errors.push(`Row ${rowNum}: receivedDate "${receivedRaw}" must be YYYY-MM-DD.`);
      return;
    }

    const vendorRaw = (row.vendor ?? "").trim();
    const vendorKey = vendorRaw ? vendorRaw.toLowerCase() : null;
    if (vendorKey && !vendorByName.has(vendorKey) && !newVendorNames.has(vendorKey)) {
      newVendorNames.set(vendorKey, vendorRaw);
    }
    if (vendorKey) {
      const prior = latestLotByItem.get(itemName.toLowerCase());
      // ">=" so that among same-date (or undated) lots the later row wins.
      if (!prior || receivedRaw >= prior.date) {
        latestLotByItem.set(itemName.toLowerCase(), { date: receivedRaw, vendorKey });
      }
    }

    const existing = itemByName.get(itemName.toLowerCase());
    if (!existing && !newItemsToCreate.has(itemName.toLowerCase())) {
      const categoryRaw = (row.category ?? "").trim();
      const uomRaw = (row.uom ?? "").trim();
      if (!categoryRaw || !uomRaw) {
        errors.push(
          `Row ${rowNum}: item "${itemName}" doesn't exist yet, so category and uom are required to create it.`
        );
        return;
      }

      const category =
        categoryByName.get(categoryRaw.toLowerCase()) ??
        (categoryIdByAlias.has(categoryRaw.toLowerCase())
          ? categories.find(
              (c) => c.id === categoryIdByAlias.get(categoryRaw.toLowerCase())
            )
          : undefined);
      if (!category) {
        errors.push(`Row ${rowNum}: no category found matching "${categoryRaw}".`);
        return;
      }

      const uom = uomByCode.get(uomRaw.toLowerCase());
      if (!uom) {
        errors.push(`Row ${rowNum}: no unit of measure found matching "${uomRaw}".`);
        return;
      }

      const materialTypeRaw = (row.materialType ?? "NA").trim().toUpperCase();
      if (!VALID_MATERIAL_TYPES.has(materialTypeRaw)) {
        errors.push(
          `Row ${rowNum}: materialType "${row.materialType}" is not one of DM, IM, PM, MM, AFS, NA.`
        );
        return;
      }

      newItemsToCreate.set(itemName.toLowerCase(), {
        name: itemName,
        brand: row.brand?.trim() || null,
        genericName: row.genericName?.trim() || null,
        variant: row.variant?.trim() || null,
        size: row.size?.trim() || null,
        specialAttribute: row.specialAttribute?.trim() || null,
        legacyId: row.legacyId?.trim() || null,
        sku: row.sku?.trim() || null,
        category: { connect: { id: category.id } },
        defaultUom: { connect: { id: uom.id } },
        materialType: materialTypeRaw as MaterialType,
      });
    }

    validRows.push({
      itemName,
      siteId: site.id,
      siteName: site.name,
      quantity,
      unitCost,
      vendorKey,
      occurredAt: receivedRaw ? new Date(`${receivedRaw}T12:00:00Z`) : null,
      notes: row.notes?.trim() || null,
    });
  });

  if (validRows.length === 0) {
    return { successCount: 0, errorCount: errors.length, errors };
  }

  if (opts.dryRun) {
    const rowsBySite: Record<string, number> = {};
    let totalValue = 0;
    for (const r of validRows) {
      rowsBySite[r.siteName] = (rowsBySite[r.siteName] ?? 0) + 1;
      totalValue += r.unitCost != null ? r.quantity * r.unitCost : 0;
    }
    return {
      successCount: validRows.length,
      errorCount: errors.length,
      errors,
      summary: {
        newItems: newItemsToCreate.size,
        newVendors: [...newVendorNames.values()],
        rowsBySite,
        totalValue,
      },
    };
  }

  // Vendors first, so new items can point at their default vendor.
  for (const [key, name] of newVendorNames) {
    vendorByName.set(key, await db.vendor.create({ data: { name } }));
  }

  // Item creation isn't wrapped in a transaction with the ledger insert below:
  // with imports running into the hundreds of new items, a single interactive
  // transaction reliably blows Prisma's default 5s timeout. Creating an item
  // that never gets a ledger row (if this process were interrupted) is a
  // harmless, recoverable state — it just sits at zero on-hand until retried.
  for (const [nameLower, data] of newItemsToCreate) {
    const defaultVendorKey = latestLotByItem.get(nameLower)?.vendorKey;
    const defaultVendor = defaultVendorKey ? vendorByName.get(defaultVendorKey) : undefined;
    const created = await db.item.create({
      data: defaultVendor ? { ...data, defaultVendor: { connect: { id: defaultVendor.id } } } : data,
    });
    itemByName.set(nameLower, created);
  }

  await db.inventoryTransaction.createMany({
    data: validRows.map((row) => {
      const item = itemByName.get(row.itemName.toLowerCase())!;
      return {
        itemId: item.id,
        siteId: row.siteId,
        type: "OPENING_BALANCE" as const,
        quantity: row.quantity,
        unitCost: row.unitCost,
        totalValue: row.unitCost != null ? row.quantity * row.unitCost : null,
        vendorId: row.vendorKey ? vendorByName.get(row.vendorKey)?.id : undefined,
        // occurredAt orders the FIFO cost layers, so it's the lot's received
        // date when the file has one; otherwise the column default (now).
        ...(row.occurredAt ? { occurredAt: row.occurredAt } : {}),
        notes: row.notes,
      };
    }),
  });

  return { successCount: validRows.length, errorCount: errors.length, errors };
}
