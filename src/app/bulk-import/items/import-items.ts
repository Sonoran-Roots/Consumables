import { db } from "@/lib/db";
import type { MaterialType, Prisma } from "@prisma/client";
import { field, parseBool, parseCsv, failure, type BulkResult } from "../csv";

const VALID_MATERIAL_TYPES = new Set(["DM", "IM", "PM", "MM", "AFS", "NA"]);

export async function runItemsImport(
  text: string,
  opts: { updateExisting: boolean; checkOnly: boolean }
): Promise<NonNullable<BulkResult>> {
  const { rows, error } = parseCsv(text);
  if (error) return failure(error, opts.checkOnly);

  const [categories, aliases, uoms, vendors, existingItems] = await Promise.all([
    db.category.findMany(),
    db.legacyCategoryAlias.findMany(),
    db.unitOfMeasure.findMany(),
    db.vendor.findMany(),
    db.item.findMany({ select: { id: true, name: true, sku: true, legacyId: true } }),
  ]);

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const categoryIdByAlias = new Map(aliases.map((a) => [a.rawCategoryName.toLowerCase(), a.categoryId]));
  const uomByCode = new Map(uoms.map((u) => [u.code.toLowerCase(), u]));
  const vendorByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v]));
  const itemByName = new Map(existingItems.map((i) => [i.name.toLowerCase(), i]));
  // Unique columns: who currently holds each value, so a clash is a clear row error
  // instead of a database constraint failure that would abort the whole batch.
  const skuOwner = new Map(existingItems.filter((i) => i.sku).map((i) => [i.sku!.toLowerCase(), i.id]));
  const legacyOwner = new Map(
    existingItems.filter((i) => i.legacyId).map((i) => [i.legacyId!.toLowerCase(), i.id])
  );

  const errors: string[] = [];
  const seenInFile = new Map<string, number>();
  const toCreate: Prisma.ItemCreateManyInput[] = [];
  const toUpdate: { id: string; data: Prisma.ItemUncheckedUpdateInput }[] = [];
  let skipped = 0;
  let skippedExisting = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2; // header row + 1-indexing
    const name = field(row, "name", "itemName", "item");
    if (!name) {
      errors.push(`Row ${rowNum}: name is required.`);
      return;
    }
    const nameKey = name.toLowerCase();
    const firstSeen = seenInFile.get(nameKey);
    if (firstSeen) {
      errors.push(`Row ${rowNum}: "${name}" is listed again (first on row ${firstSeen}) — skipped.`);
      return;
    }
    seenInFile.set(nameKey, rowNum);

    const existing = itemByName.get(nameKey);
    if (existing && !opts.updateExisting) {
      skipped++;
      skippedExisting++;
      return;
    }

    const categoryRaw = field(row, "category");
    const uomRaw = field(row, "uom", "unitOfMeasure", "unit");
    const materialRaw = field(row, "materialType", "material").toUpperCase();
    const vendorRaw = field(row, "defaultVendor", "vendor");
    const sku = field(row, "sku");
    const legacyId = field(row, "legacyId", "id");
    const isActive = parseBool(field(row, "isActive", "active"));

    const problems: string[] = [];

    let categoryId: string | undefined;
    if (categoryRaw) {
      const id =
        categoryByName.get(categoryRaw.toLowerCase())?.id ?? categoryIdByAlias.get(categoryRaw.toLowerCase());
      if (id) categoryId = id;
      else problems.push(`no category matching "${categoryRaw}"`);
    }
    let defaultUomId: string | undefined;
    if (uomRaw) {
      const u = uomByCode.get(uomRaw.toLowerCase());
      if (u) defaultUomId = u.id;
      else problems.push(`no unit of measure matching "${uomRaw}"`);
    }
    if (materialRaw && !VALID_MATERIAL_TYPES.has(materialRaw)) {
      problems.push(`materialType "${materialRaw}" is not one of DM, IM, PM, MM, AFS, NA`);
    }
    let defaultVendorId: string | undefined;
    if (vendorRaw) {
      const v = vendorByName.get(vendorRaw.toLowerCase());
      if (v) defaultVendorId = v.id;
      else problems.push(`vendor "${vendorRaw}" doesn't exist — import vendors first`);
    }
    if (isActive === null) problems.push(`isActive "${field(row, "isActive", "active")}" should be yes or no`);
    if (!existing) {
      if (!categoryRaw) problems.push("category is required for a new item");
      if (!uomRaw) problems.push("uom is required for a new item");
    }
    if (sku) {
      const owner = skuOwner.get(sku.toLowerCase());
      if (owner && owner !== existing?.id) problems.push(`SKU "${sku}" is already used by another item`);
    }
    if (legacyId) {
      const owner = legacyOwner.get(legacyId.toLowerCase());
      if (owner && owner !== existing?.id) problems.push(`legacyId "${legacyId}" is already used by another item`);
    }

    if (problems.length > 0) {
      errors.push(`Row ${rowNum} (${name}): ${problems.join("; ")}.`);
      return;
    }

    // Claim the unique values so a later row in this file can't reuse them.
    if (sku) skuOwner.set(sku.toLowerCase(), existing?.id ?? `new:${nameKey}`);
    if (legacyId) legacyOwner.set(legacyId.toLowerCase(), existing?.id ?? `new:${nameKey}`);

    const optional = {
      brand: field(row, "brand") || undefined,
      genericName: field(row, "genericName") || undefined,
      variant: field(row, "variant") || undefined,
      size: field(row, "size") || undefined,
      specialAttribute: field(row, "specialAttribute") || undefined,
      sku: sku || undefined,
      legacyId: legacyId || undefined,
    };

    if (existing) {
      // Update only what the row actually provides — blank cells never clear a field.
      const data: Prisma.ItemUncheckedUpdateInput = { ...optional };
      if (categoryId) data.categoryId = categoryId;
      if (defaultUomId) data.defaultUomId = defaultUomId;
      if (materialRaw) data.materialType = materialRaw as MaterialType;
      if (defaultVendorId) data.defaultVendorId = defaultVendorId;
      if (typeof isActive === "boolean") data.isActive = isActive;
      const changed = Object.values(data).some((v) => v !== undefined);
      if (changed) toUpdate.push({ id: existing.id, data });
      else skipped++;
      return;
    }

    toCreate.push({
      name,
      ...optional,
      categoryId: categoryId!,
      defaultUomId: defaultUomId!,
      materialType: (materialRaw || "NA") as MaterialType,
      defaultVendorId,
      isActive: isActive ?? true,
    });
  });

  const notes: string[] = [];
  if (skippedExisting > 0) {
    notes.push(
      `${skippedExisting} row${skippedExisting === 1 ? "" : "s"} skipped because the item already exists — tick "Update existing items" to change them.`
    );
  }

  const result: NonNullable<BulkResult> = {
    checkOnly: opts.checkOnly,
    created: toCreate.length,
    updated: toUpdate.length,
    skipped,
    errors,
    notes,
  };
  if (opts.checkOnly || (toCreate.length === 0 && toUpdate.length === 0)) return result;

  try {
    await db.$transaction([
      db.item.createMany({ data: toCreate }),
      ...toUpdate.map((u) => db.item.update({ where: { id: u.id }, data: u.data })),
    ]);
  } catch (e) {
    return failure(`Nothing was saved — the database rejected the batch: ${(e as Error).message}`);
  }
  return result;
}
