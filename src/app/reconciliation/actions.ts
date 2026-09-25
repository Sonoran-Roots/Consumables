"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type LineComputation = {
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
// audit discrepancies. This is the read side of reconciliation: it never
// writes anything, so it's safe to call repeatedly while a reconciliation
// is OPEN (a "refresh") without side effects.
async function computeReconciliationLines(
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

async function writeLines(reconciliationId: string, lines: LineComputation[]) {
  await db.$transaction([
    db.reconciliationLine.deleteMany({ where: { reconciliationId } }),
    db.reconciliationLine.createMany({
      data: lines.map((l) => ({ reconciliationId, ...l })),
    }),
  ]);
}

export type CreateReconciliationState = { error?: string } | null;

export async function createReconciliation(
  _prevState: CreateReconciliationState,
  formData: FormData
): Promise<CreateReconciliationState> {
  const siteId = String(formData.get("siteId") ?? "");
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!siteId || !periodStartRaw || !periodEndRaw) {
    return { error: "Site, period start, and period end are required." };
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "Invalid period dates." };
  }
  if (periodEnd <= periodStart) {
    return { error: "Period end must be after period start." };
  }

  const reconciliation = await db.inventoryReconciliation.create({
    data: { siteId, periodStart, periodEnd, notes },
  });

  const lines = await computeReconciliationLines(siteId, periodStart, periodEnd);
  await writeLines(reconciliation.id, lines);

  revalidatePath("/reconciliation");
  redirect(`/reconciliation/${reconciliation.id}`);
}

// Creates one OPEN reconciliation per active site for the same period in a
// single action — month-end close otherwise means repeating the same form
// 19 times.
export async function createReconciliationForAllSites(formData: FormData) {
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  if (!periodStartRaw || !periodEndRaw) return;

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) return;
  if (periodEnd <= periodStart) return;

  const sites = await db.site.findMany({ where: { isActive: true } });

  for (const site of sites) {
    const reconciliation = await db.inventoryReconciliation.create({
      data: { siteId: site.id, periodStart, periodEnd },
    });
    const lines = await computeReconciliationLines(site.id, periodStart, periodEnd);
    await writeLines(reconciliation.id, lines);
  }

  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}

export async function refreshReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });
  if (reconciliation.status === "CLOSED") return;

  const lines = await computeReconciliationLines(
    reconciliation.siteId,
    reconciliation.periodStart,
    reconciliation.periodEnd
  );
  await writeLines(reconciliationId, lines);

  revalidatePath(`/reconciliation/${reconciliationId}`);
}

export async function closeReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  const closedById = String(formData.get("closedById") ?? "") || null;
  if (!reconciliationId) return;

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });
  if (reconciliation.status === "CLOSED") return;

  // Final recompute right before freezing, so the snapshot reflects
  // anything entered right up to close time.
  const lines = await computeReconciliationLines(
    reconciliation.siteId,
    reconciliation.periodStart,
    reconciliation.periodEnd
  );
  await writeLines(reconciliationId, lines);

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { status: "CLOSED", closedAt: new Date(), closedById },
  });

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
}

// Deliberately unlocks a closed period for correction. The frozen numbers
// stay as they are until the next refresh/close — reopening alone doesn't
// recompute anything.
export async function reopenReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { status: "OPEN", closedAt: null, closedById: null },
  });

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
}

export type UpdateReconciliationHeaderState = { error?: string } | null;

export async function updateReconciliationHeader(
  _prevState: UpdateReconciliationHeaderState,
  formData: FormData
): Promise<UpdateReconciliationHeaderState> {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!reconciliationId || !siteId || !periodStartRaw || !periodEndRaw) {
    return { error: "Site, period start, and period end are required." };
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "Invalid period dates." };
  }
  if (periodEnd <= periodStart) {
    return { error: "Period end must be after period start." };
  }

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });

  if (reconciliation.status === "CLOSED") {
    // Notes are safe metadata and stay editable regardless of status; the
    // site/period (and therefore the frozen numbers) require reopening
    // first, same as any other change to a closed snapshot.
    await db.inventoryReconciliation.update({
      where: { id: reconciliationId },
      data: { notes },
    });
    revalidatePath("/reconciliation");
    revalidatePath(`/reconciliation/${reconciliationId}`);
    redirect(`/reconciliation/${reconciliationId}`);
  }

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { siteId, periodStart, periodEnd, notes },
  });

  const lines = await computeReconciliationLines(siteId, periodStart, periodEnd);
  await writeLines(reconciliationId, lines);

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
  redirect(`/reconciliation/${reconciliationId}`);
}

export async function deleteReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  await db.inventoryReconciliation.delete({ where: { id: reconciliationId } });
  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}
