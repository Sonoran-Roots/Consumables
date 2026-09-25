import { db } from "@/lib/db";
import { parse } from "csv-parse/sync";
import type { MaterialType, Prisma } from "@prisma/client";

export type ImportResult = {
  successCount: number;
  errorCount: number;
  errors: string[];
};

const VALID_MATERIAL_TYPES = new Set(["DM", "IM", "PM", "MM", "AFS", "NA"]);

export async function runInventoryImport(text: string): Promise<ImportResult> {
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

  const [categories, aliases, uoms, sites, existingItems] = await Promise.all([
    db.category.findMany(),
    db.legacyCategoryAlias.findMany(),
    db.unitOfMeasure.findMany(),
    db.site.findMany({ include: { book: true } }),
    db.item.findMany(),
  ]);

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
    quantity: number;
    unitCost: number | null;
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
        sku: row.sku?.trim() || null,
        category: { connect: { id: category.id } },
        defaultUom: { connect: { id: uom.id } },
        materialType: materialTypeRaw as MaterialType,
      });
    }

    validRows.push({
      itemName,
      siteId: site.id,
      quantity,
      unitCost,
      notes: row.notes?.trim() || null,
    });
  });

  if (validRows.length === 0) {
    return { successCount: 0, errorCount: errors.length, errors };
  }

  // Item creation isn't wrapped in a transaction with the ledger insert below:
  // with imports running into the hundreds of new items, a single interactive
  // transaction reliably blows Prisma's default 5s timeout. Creating an item
  // that never gets a ledger row (if this process were interrupted) is a
  // harmless, recoverable state — it just sits at zero on-hand until retried.
  for (const [nameLower, data] of newItemsToCreate) {
    const created = await db.item.create({ data });
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
        notes: row.notes,
      };
    }),
  });

  return { successCount: validRows.length, errorCount: errors.length, errors };
}
