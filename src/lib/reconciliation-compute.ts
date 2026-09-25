import { db } from "@/lib/db";

export type LineComputation = {
  itemId: string;
  beginningQty: number;
  endingQty: number;
  unitCost: number | null;
  endingValue: number | null;
  purchasedQty: number;
  purchasedValue: number;
  transferInQty: number;
  transferInValue: number;
  transferOutQty: number;
  transferOutValue: number;
  consumedQty: number;
  discrepancyQty: number;
  usageRatePerDay: number;
};

type Bucket = {
  purchasedQty: number;
  purchasedValue: number;
  transferInQty: number;
  transferInValue: number;
  transferOutQty: number;
  transferOutValue: number;
  consumedQty: number;
  discrepancyQty: number;
};

function emptyBucket(): Bucket {
  return {
    purchasedQty: 0,
    purchasedValue: 0,
    transferInQty: 0,
    transferInValue: 0,
    transferOutQty: 0,
    transferOutValue: 0,
    consumedQty: 0,
    discrepancyQty: 0,
  };
}

// Computes, for every item touched at a site, on-hand at the start and end
// of a period plus a breakdown of what moved during it — purchases,
// transfers in/out, usage (sales/checkouts/damaged, net of returns), and
// audit discrepancies. Pure read, no side effects — used both by the
// reconciliation snapshot actions and the cross-site usage report.
export async function computeReconciliationLines(
  siteId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<LineComputation[]> {
  // periodEnd arrives as a pure calendar date (UTC midnight of that day) —
  // treat the period as inclusive of that whole day, not excluding it, by
  // pushing the upper bound to the start of the next day. Otherwise
  // anything that happened ON the end date (very common — "as of today")
  // silently falls outside the period.
  const periodEndExclusive = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);

  const periodDays = Math.max(
    (periodEndExclusive.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    1
  );

  const [beginningRows, endingRows, periodByType] = await Promise.all([
    db.inventoryTransaction.groupBy({
      by: ["itemId"],
      where: { siteId, occurredAt: { lt: periodStart } },
      _sum: { quantity: true },
    }),
    db.inventoryTransaction.groupBy({
      by: ["itemId"],
      where: { siteId, occurredAt: { lt: periodEndExclusive } },
      _sum: { quantity: true },
    }),
    db.inventoryTransaction.groupBy({
      by: ["itemId", "type"],
      where: { siteId, occurredAt: { gte: periodStart, lt: periodEndExclusive } },
      _sum: { quantity: true, totalValue: true },
    }),
  ]);

  const beginningMap = new Map(beginningRows.map((r) => [r.itemId, r._sum.quantity ?? 0]));
  const endingMap = new Map(endingRows.map((r) => [r.itemId, r._sum.quantity ?? 0]));

  const bucketMap = new Map<string, Bucket>();
  function bucketFor(itemId: string): Bucket {
    let b = bucketMap.get(itemId);
    if (!b) {
      b = emptyBucket();
      bucketMap.set(itemId, b);
    }
    return b;
  }

  for (const row of periodByType) {
    const qty = row._sum.quantity ?? 0;
    const val = row._sum.totalValue ?? 0;
    const b = bucketFor(row.itemId);
    switch (row.type) {
      case "PURCHASE":
        b.purchasedQty += qty;
        b.purchasedValue += val;
        break;
      case "TRANSFER_IN":
        b.transferInQty += qty;
        b.transferInValue += val;
        break;
      case "TRANSFER_OUT":
        b.transferOutQty += Math.abs(qty);
        b.transferOutValue += Math.abs(val);
        break;
      case "SALE":
      case "SALE_OUT_OF_STATE":
      case "DAMAGED":
      case "CHECKOUT":
        b.consumedQty += Math.abs(qty);
        break;
      case "CHECKOUT_RETURN":
        b.consumedQty -= Math.abs(qty);
        break;
      case "DISCREPANCY":
        b.discrepancyQty += qty;
        break;
      default:
        break;
    }
  }

  const allItemIds = new Set<string>([
    ...beginningMap.keys(),
    ...endingMap.keys(),
    ...bucketMap.keys(),
  ]);

  const keptItemIds = [...allItemIds].filter((itemId) => {
    const beginningQty = beginningMap.get(itemId) ?? 0;
    const endingQty = endingMap.get(itemId) ?? 0;
    const b = bucketMap.get(itemId) ?? emptyBucket();
    return (
      beginningQty !== 0 ||
      endingQty !== 0 ||
      b.purchasedQty !== 0 ||
      b.transferInQty !== 0 ||
      b.transferOutQty !== 0 ||
      b.consumedQty !== 0 ||
      b.discrepancyQty !== 0
    );
  });

  if (keptItemIds.length === 0) return [];

  // Valuation cost: the most recent known unit cost for the item as of
  // periodEnd, across any site — one batched query instead of one per item.
  const costRows = await db.inventoryTransaction.findMany({
    where: {
      itemId: { in: keptItemIds },
      unitCost: { not: null },
      occurredAt: { lt: periodEndExclusive },
    },
    orderBy: { occurredAt: "desc" },
    select: { itemId: true, unitCost: true },
  });
  const costMap = new Map<string, number>();
  for (const row of costRows) {
    if (!costMap.has(row.itemId) && row.unitCost != null) {
      costMap.set(row.itemId, row.unitCost);
    }
  }

  return keptItemIds.map((itemId) => {
    const beginningQty = beginningMap.get(itemId) ?? 0;
    const endingQty = endingMap.get(itemId) ?? 0;
    const b = bucketMap.get(itemId) ?? emptyBucket();
    const unitCost = costMap.get(itemId) ?? null;

    return {
      itemId,
      beginningQty,
      endingQty,
      unitCost,
      endingValue: unitCost != null ? endingQty * unitCost : null,
      purchasedQty: b.purchasedQty,
      purchasedValue: b.purchasedValue,
      transferInQty: b.transferInQty,
      transferInValue: b.transferInValue,
      transferOutQty: b.transferOutQty,
      transferOutValue: b.transferOutValue,
      consumedQty: b.consumedQty,
      discrepancyQty: b.discrepancyQty,
      usageRatePerDay: b.consumedQty / periodDays,
    };
  });
}
