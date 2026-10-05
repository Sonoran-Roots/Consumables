import { db } from "@/lib/db";

// Generated SKUs look like SKU-000123: one running sequence for the whole
// catalog, numbered after the highest one already in use. To change the
// format, change these two constants — nothing else depends on them.
const PREFIX = "SKU-";
const PAD = 6;

const PATTERN = new RegExp(`^${PREFIX}(\\d+)$`, "i");

export const formatSku = (n: number) => `${PREFIX}${String(n).padStart(PAD, "0")}`;

async function highestGeneratedNumber(): Promise<number> {
  const rows = await db.item.findMany({
    where: { sku: { startsWith: PREFIX, mode: "insensitive" } },
    select: { sku: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = PATTERN.exec(r.sku ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// Returns a function that hands out the next unused SKU each time it's called.
// `reserved` is a case-insensitive check for SKUs the caller already knows are
// taken but that aren't in the database yet (e.g. other rows in the same file),
// so a generated value never collides with one a user typed in.
export async function skuGenerator(
  reserved?: (lowerCaseSku: string) => boolean,
  opts: { fromEmpty?: boolean } = {}
) {
  // fromEmpty: numbering for a rehearsal that assumes the catalog is empty.
  let next = (opts.fromEmpty ? 0 : await highestGeneratedNumber()) + 1;
  return () => {
    let sku = formatSku(next++);
    while (reserved?.(sku.toLowerCase())) sku = formatSku(next++);
    return sku;
  };
}
