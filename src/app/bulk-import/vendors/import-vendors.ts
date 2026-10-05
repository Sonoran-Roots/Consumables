import { db } from "@/lib/db";
import { field, parseBool, parseCsv, failure, type BulkResult } from "../csv";

export async function runVendorsImport(
  text: string,
  opts: { checkOnly: boolean }
): Promise<NonNullable<BulkResult>> {
  const { rows, error } = parseCsv(text);
  if (error) return failure(error, opts.checkOnly);

  const existing = await db.vendor.findMany({ select: { name: true } });
  const known = new Set(existing.map((v) => v.name.toLowerCase()));

  const errors: string[] = [];
  const toCreate: { name: string; isActive: boolean }[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const name = field(row, "name", "vendor", "vendorName");
    if (!name) {
      errors.push(`Row ${rowNum}: name is required.`);
      return;
    }
    const isActive = parseBool(field(row, "isActive", "active"));
    if (isActive === null) {
      errors.push(`Row ${rowNum} (${name}): isActive should be yes or no.`);
      return;
    }
    // Compared case-insensitively so "HBS" and "hbs" can't both end up in the list.
    if (known.has(name.toLowerCase())) {
      skipped++;
      return;
    }
    known.add(name.toLowerCase());
    toCreate.push({ name, isActive: isActive ?? true });
  });

  const result: NonNullable<BulkResult> = {
    checkOnly: opts.checkOnly,
    created: toCreate.length,
    updated: 0,
    skipped,
    errors,
    notes:
      skipped > 0
        ? [`${skipped} row${skipped === 1 ? "" : "s"} skipped because that vendor already exists (or is repeated in the file).`]
        : [],
  };
  if (opts.checkOnly || toCreate.length === 0) return result;

  try {
    await db.vendor.createMany({ data: toCreate });
  } catch (e) {
    return failure(`Nothing was saved — the database rejected the batch: ${(e as Error).message}`);
  }
  return result;
}
