import { db } from "@/lib/db";
import type { TransactionType } from "@prisma/client";

// "Used or missing inventory" — sales, net checkouts (a return gives some
// back), damage, and audit discrepancies, all as a signed contribution to
// how much left the shelf. A negative audit discrepancy (counted less than
// the system expected) counts as usage: if there's no other explanation for
// where it went, it was most likely used or lost without ever being logged
// as a checkout. A positive discrepancy (found more than expected) offsets
// that the same way a checkout return offsets a checkout. Shared between
// the reconciliation snapshot below and the item detail page's utilization
// trend, so both agree on what counts as "used."
export function consumptionDelta(type: TransactionType, quantity: number): number {
  switch (type) {
    case "SALE":
    case "SALE_OUT_OF_STATE":
    case "DAMAGED":
    case "CHECKOUT":
      return Math.abs(quantity);
    case "CHECKOUT_RETURN":
      return -Math.abs(quantity);
    case "DISCREPANCY":
      return -quantity;
    default:
      return 0;
  }
}

export type LineComputation = {
  itemId: string;
  beginningQty: number;
  endingQty: number;
  unitCost: number | null;
  endingValue: number | null;
  beginningValue: number | null;
  purchasedQty: number;
  purchasedValue: number;
  producedQty: number;
  producedValue: number;
  transferInQty: number;
  transferInValue: number;
  transferOutQty: number;
  transferOutValue: number;
  soldQty: number;
  soldValue: number;
  soldAkQty: number;
  soldAkValue: number;
  usedQty: number;
  usedValue: number;
  consumedQty: number;
  discrepancyQty: number;
  discrepancyValue: number;
  usageRatePerDay: number;
};

type Bucket = {
  purchasedQty: number;
  purchasedValue: number;
  producedQty: number;
  transferInQty: number;
  transferInValue: number;
  transferOutQty: number;
  transferOutValue: number;
  soldQty: number;
  soldAkQty: number;
  usedQty: number;
  consumedQty: number;
  discrepancyQty: number;
};

function emptyBucket(): Bucket {
  return {
    purchasedQty: 0,
    purchasedValue: 0,
    producedQty: 0,
    transferInQty: 0,
    transferInValue: 0,
    transferOutQty: 0,
    transferOutValue: 0,
    soldQty: 0,
    soldAkQty: 0,
    usedQty: 0,
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
      case "PRODUCTION":
        b.producedQty += qty;
        break;
      case "SALE":
        b.soldQty += Math.abs(qty);
        b.consumedQty += consumptionDelta(row.type, qty);
        break;
      case "SALE_OUT_OF_STATE":
        b.soldAkQty += Math.abs(qty);
        b.consumedQty += consumptionDelta(row.type, qty);
        break;
      case "DAMAGED":
      case "CHECKOUT":
      case "CHECKOUT_RETURN":
        b.usedQty += consumptionDelta(row.type, qty);
        b.consumedQty += consumptionDelta(row.type, qty);
        break;
      case "DISCREPANCY":
        b.discrepancyQty += qty;
        b.usedQty += consumptionDelta(row.type, qty);
        b.consumedQty += consumptionDelta(row.type, qty);
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
      b.producedQty !== 0 ||
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
    // Purchased/transfer values use each transaction's own recorded cost
    // (accurate). Everything below has no per-transaction cost captured
    // today (checkouts, sales, discrepancies, production don't record
    // one), so it's estimated from the item's most recently known cost —
    // same approach as endingValue, and same caveat: an estimate, not a
    // recorded actual, until those flows start capturing cost themselves.
    const valueOf = (qty: number) => (unitCost != null ? qty * unitCost : 0);

    return {
      itemId,
      beginningQty,
      endingQty,
      unitCost,
      endingValue: unitCost != null ? endingQty * unitCost : null,
      beginningValue: unitCost != null ? beginningQty * unitCost : null,
      purchasedQty: b.purchasedQty,
      purchasedValue: b.purchasedValue,
      producedQty: b.producedQty,
      producedValue: valueOf(b.producedQty),
      transferInQty: b.transferInQty,
      transferInValue: b.transferInValue,
      transferOutQty: b.transferOutQty,
      transferOutValue: b.transferOutValue,
      soldQty: b.soldQty,
      soldValue: valueOf(b.soldQty),
      soldAkQty: b.soldAkQty,
      soldAkValue: valueOf(b.soldAkQty),
      usedQty: b.usedQty,
      usedValue: valueOf(b.usedQty),
      consumedQty: b.consumedQty,
      discrepancyQty: b.discrepancyQty,
      discrepancyValue: valueOf(b.discrepancyQty),
      usageRatePerDay: b.consumedQty / periodDays,
    };
  });
}
