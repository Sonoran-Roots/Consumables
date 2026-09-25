"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PurchaseOrderStatus } from "@prisma/client";

export type CreatePurchaseOrderState = { error?: string } | null;

export async function createPurchaseOrder(
  _prevState: CreatePurchaseOrderState,
  formData: FormData
): Promise<CreatePurchaseOrderState> {
  const siteId = String(formData.get("siteId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const poNumber = String(formData.get("poNumber") ?? "").trim();
  const orderDateRaw = String(formData.get("orderDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!siteId || !vendorId || !poNumber || !orderDateRaw) {
    return { error: "Site, vendor, PO number, and order date are required." };
  }

  const orderDate = new Date(orderDateRaw);
  if (Number.isNaN(orderDate.getTime())) {
    return { error: "Invalid order date." };
  }

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantityOrdered").map(Number);
  const unitCosts = formData.getAll("unitCost").map(Number);

  const lines = itemIds
    .map((itemId, i) => ({
      itemId,
      quantityOrdered: quantities[i],
      unitCost: unitCosts[i],
    }))
    .filter((l) => l.itemId && l.quantityOrdered > 0 && l.unitCost >= 0);

  if (lines.length === 0) {
    return { error: "Add at least one line item with a quantity greater than zero." };
  }

  let purchaseOrder;
  try {
    purchaseOrder = await db.purchaseOrder.create({
      data: {
        siteId,
        vendorId,
        poNumber,
        orderDate,
        notes,
        lines: { create: lines },
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `PO number "${poNumber}" is already in use.` };
    }
    return { error: "Could not create purchase order. Please try again." };
  }

  revalidatePath("/purchasing");
  redirect(`/purchasing/${purchaseOrder.id}`);
}

export type UpdatePurchaseOrderState = { error?: string } | null;

// Edits the PO header and its lines, including lines that already have
// posted PURCHASE transactions (tied via purchaseOrderLineId). Reconciles
// those existing transactions to match: item/unit cost/site changes update
// the posted rows in place (quantity received is left alone — that's a
// historical fact of what physically arrived), and a removed line deletes
// its posted transactions along with it.
export async function updatePurchaseOrder(
  _prevState: UpdatePurchaseOrderState,
  formData: FormData
): Promise<UpdatePurchaseOrderState> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const poNumber = String(formData.get("poNumber") ?? "").trim();
  const orderDateRaw = String(formData.get("orderDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const paidInFull = formData.get("paidInFull") === "on";

  if (!purchaseOrderId || !siteId || !vendorId || !poNumber || !orderDateRaw) {
    return { error: "Site, vendor, PO number, and order date are required." };
  }

  const orderDate = new Date(orderDateRaw);
  if (Number.isNaN(orderDate.getTime())) {
    return { error: "Invalid order date." };
  }

  const lineIds = formData.getAll("lineId").map(String);
  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantityOrdered").map(Number);
  const unitCosts = formData.getAll("unitCost").map(Number);

  const submittedLines = lineIds
    .map((lineId, i) => ({
      lineId: lineId || null,
      itemId: itemIds[i],
      quantityOrdered: quantities[i],
      unitCost: unitCosts[i],
    }))
    .filter((l) => l.itemId && l.quantityOrdered > 0 && l.unitCost >= 0);

  if (submittedLines.length === 0) {
    return { error: "Add at least one line item with a quantity greater than zero." };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: purchaseOrderId },
        include: { lines: true },
      });

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { siteId, vendorId, poNumber, orderDate, notes, paidInFull },
      });

      const keptLineIds = new Set(
        submittedLines.filter((l) => l.lineId).map((l) => l.lineId)
      );

      for (const line of existing.lines) {
        if (!keptLineIds.has(line.id)) {
          await tx.inventoryTransaction.deleteMany({
            where: { purchaseOrderLineId: line.id },
          });
          await tx.purchaseOrderLine.delete({ where: { id: line.id } });
        }
      }

      for (const line of submittedLines) {
        if (line.lineId) {
          await tx.purchaseOrderLine.update({
            where: { id: line.lineId },
            data: {
              itemId: line.itemId,
              quantityOrdered: line.quantityOrdered,
              unitCost: line.unitCost,
            },
          });
          const transactions = await tx.inventoryTransaction.findMany({
            where: { purchaseOrderLineId: line.lineId },
          });
          for (const t of transactions) {
            await tx.inventoryTransaction.update({
              where: { id: t.id },
              data: {
                itemId: line.itemId,
                siteId,
                vendorId,
                unitCost: line.unitCost,
                totalValue: t.quantity * line.unitCost,
              },
            });
          }
        } else {
          await tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId,
              itemId: line.itemId,
              quantityOrdered: line.quantityOrdered,
              unitCost: line.unitCost,
            },
          });
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `PO number "${poNumber}" is already in use.` };
    }
    return { error: "Could not update purchase order. Please try again." };
  }

  await recomputeStatus(purchaseOrderId);

  revalidatePath("/inventory");
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${purchaseOrderId}`);
  redirect(`/purchasing/${purchaseOrderId}`);
}

async function recomputeStatus(purchaseOrderId: string) {
  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { lines: { include: { inventoryTransactions: true } } },
  });

  const receivedByLine = po.lines.map((line) =>
    line.inventoryTransactions.reduce((sum, t) => sum + t.quantity, 0)
  );
  const anyReceived = receivedByLine.some((qty) => qty > 0);
  const allFullyReceived =
    po.lines.length > 0 &&
    po.lines.every((line, i) => receivedByLine[i] >= line.quantityOrdered);

  let status: PurchaseOrderStatus = "OPEN";
  if (allFullyReceived) status = "FULLY_RECEIVED";
  else if (anyReceived) status = "PARTIALLY_RECEIVED";

  if (status !== po.status && po.status !== "CLOSED") {
    await db.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });
  }
}

// Records one partial (or final) delivery: for every line with a quantity
// entered, posts a real PURCHASE transaction at the PO's site, dated the
// delivery date, linked back to that line so receiving history stays
// queryable per line item.
export async function recordDelivery(formData: FormData) {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const receivedDateRaw = String(formData.get("receivedDate") ?? "");
  if (!purchaseOrderId || !receivedDateRaw) return;

  const receivedDate = new Date(receivedDateRaw);
  if (Number.isNaN(receivedDate.getTime())) return;

  const po = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });

  const entries = po.lines
    .map((line) => {
      const raw = formData.get(`qty-${line.id}`);
      const trimmed = raw != null ? String(raw).trim() : "";
      const qty = trimmed !== "" ? Number(trimmed) : 0;
      return { line, qty };
    })
    .filter((e) => e.qty > 0);

  if (entries.length === 0) return;

  await db.inventoryTransaction.createMany({
    data: entries.map(({ line, qty }) => ({
      itemId: line.itemId,
      siteId: po.siteId,
      type: "PURCHASE" as const,
      quantity: qty,
      unitCost: line.unitCost,
      totalValue: qty * line.unitCost,
      vendorId: po.vendorId,
      purchaseOrderId: po.id,
      purchaseOrderLineId: line.id,
      occurredAt: receivedDate,
    })),
  });

  await recomputeStatus(purchaseOrderId);

  revalidatePath("/inventory");
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function recordPayment(formData: FormData) {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const paymentDateRaw = String(formData.get("paymentDate") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!purchaseOrderId || !paymentDateRaw || !amountRaw) return;

  await db.purchaseOrderPayment.create({
    data: {
      purchaseOrderId,
      paymentDate: new Date(paymentDateRaw),
      amount: Number(amountRaw),
    },
  });

  revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function updatePayment(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const paymentDateRaw = String(formData.get("paymentDate") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  if (!paymentId || !paymentDateRaw || !amountRaw) return;

  await db.purchaseOrderPayment.update({
    where: { id: paymentId },
    data: { paymentDate: new Date(paymentDateRaw), amount: Number(amountRaw) },
  });

  revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function deletePayment(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!paymentId) return;

  await db.purchaseOrderPayment.delete({ where: { id: paymentId } });
  revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function updateVendorCreditAction(formData: FormData) {
  const creditId = String(formData.get("creditId") ?? "");
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const creditDateRaw = String(formData.get("creditDate") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const accountingNotified = formData.get("accountingNotified") === "on";
  if (!creditId || !creditDateRaw || !amountRaw) return;

  await db.vendorCredit.update({
    where: { id: creditId },
    data: {
      creditDate: new Date(creditDateRaw),
      amount: Number(amountRaw),
      notes,
      accountingNotified,
    },
  });

  if (purchaseOrderId) revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function deleteVendorCreditAction(formData: FormData) {
  const creditId = String(formData.get("creditId") ?? "");
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!creditId) return;

  await db.vendorCredit.delete({ where: { id: creditId } });
  if (purchaseOrderId) revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function markPaidInFull(formData: FormData) {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return;

  await db.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { paidInFull: true },
  });

  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function closePurchaseOrder(formData: FormData) {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return;

  await db.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: "CLOSED" },
  });

  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${purchaseOrderId}`);
}

export async function addVendorCredit(formData: FormData) {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const creditDateRaw = String(formData.get("creditDate") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const accountingNotified = formData.get("accountingNotified") === "on";

  if (!vendorId || !creditDateRaw || !amountRaw) return;

  await db.vendorCredit.create({
    data: {
      vendorId,
      purchaseOrderId: purchaseOrderId || null,
      creditDate: new Date(creditDateRaw),
      amount: Number(amountRaw),
      notes,
      accountingNotified,
    },
  });

  if (purchaseOrderId) revalidatePath(`/purchasing/${purchaseOrderId}`);
  revalidatePath("/vendor-credits");
}
