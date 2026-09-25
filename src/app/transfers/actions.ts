"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateTransferState = { error?: string } | null;

export async function createTransfer(
  _prevState: CreateTransferState,
  formData: FormData
): Promise<CreateTransferState> {
  const fromSiteId = String(formData.get("fromSiteId") ?? "");
  const toSiteId = String(formData.get("toSiteId") ?? "");
  const requestedById = String(formData.get("requestedById") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const unitCosts = formData.getAll("unitCost").map((v) => (v === "" ? null : Number(v)));

  if (!fromSiteId || !toSiteId) {
    return { error: "Please choose both a source and destination site." };
  }
  if (fromSiteId === toSiteId) {
    return { error: "Source and destination site must be different." };
  }

  const lines = itemIds
    .map((itemId, i) => ({
      itemId,
      quantity: quantities[i],
      unitCost: unitCosts[i] ?? undefined,
    }))
    .filter((l) => l.itemId && l.quantity > 0);

  if (lines.length === 0) {
    return { error: "Add at least one item with a quantity greater than zero." };
  }

  const transfer = await db.transfer.create({
    data: {
      fromSiteId,
      toSiteId,
      requestedById,
      notes,
      lines: { create: lines },
    },
  });

  revalidatePath("/transfers");
  redirect(`/transfers/${transfer.id}`);
}

export type UpdateTransferState = { error?: string } | null;

export async function updateTransfer(
  _prevState: UpdateTransferState,
  formData: FormData
): Promise<UpdateTransferState> {
  const transferId = String(formData.get("transferId") ?? "");
  const fromSiteId = String(formData.get("fromSiteId") ?? "");
  const toSiteId = String(formData.get("toSiteId") ?? "");
  const requestedById = String(formData.get("requestedById") ?? "") || null;
  const receivedById = String(formData.get("receivedById") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const unitCosts = formData.getAll("unitCost").map((v) => (v === "" ? null : Number(v)));

  if (!transferId || !fromSiteId || !toSiteId) {
    return { error: "Please choose both a source and destination site." };
  }
  if (fromSiteId === toSiteId) {
    return { error: "Source and destination site must be different." };
  }

  const lines = itemIds
    .map((itemId, i) => ({
      itemId,
      quantity: quantities[i],
      unitCost: unitCosts[i] ?? undefined,
    }))
    .filter((l) => l.itemId && l.quantity > 0);

  if (lines.length === 0) {
    return { error: "Add at least one item with a quantity greater than zero." };
  }

  const existing = await db.transfer.findUniqueOrThrow({ where: { id: transferId } });

  // If this transfer already posted to the ledger (status RECEIVED), the
  // posted TRANSFER_OUT/TRANSFER_IN rows are tied to it via transferId —
  // delete and repost them to match the edited sites/lines, so on-hand
  // stays consistent with what's now on the transfer instead of silently
  // drifting from it.
  await db.$transaction([
    db.transfer.update({
      where: { id: transferId },
      data: { fromSiteId, toSiteId, requestedById, receivedById, notes },
    }),
    db.transferLine.deleteMany({ where: { transferId } }),
    db.transferLine.createMany({
      data: lines.map((l) => ({ transferId, ...l })),
    }),
    ...(existing.status === "RECEIVED"
      ? [
          db.inventoryTransaction.deleteMany({ where: { transferId } }),
          ...lines.flatMap((line) => [
            db.inventoryTransaction.create({
              data: {
                itemId: line.itemId,
                siteId: fromSiteId,
                type: "TRANSFER_OUT" as const,
                quantity: -Math.abs(line.quantity),
                unitCost: line.unitCost ?? null,
                totalValue:
                  line.unitCost != null ? -Math.abs(line.quantity) * line.unitCost : null,
                transferId,
                employeeId: receivedById ?? undefined,
              },
            }),
            db.inventoryTransaction.create({
              data: {
                itemId: line.itemId,
                siteId: toSiteId,
                type: "TRANSFER_IN" as const,
                quantity: Math.abs(line.quantity),
                unitCost: line.unitCost ?? null,
                totalValue:
                  line.unitCost != null ? Math.abs(line.quantity) * line.unitCost : null,
                transferId,
                employeeId: receivedById ?? undefined,
              },
            }),
          ]),
        ]
      : []),
  ]);

  revalidatePath("/transfers");
  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/inventory");
  redirect(`/transfers/${transferId}`);
}

export async function receiveTransferAction(formData: FormData) {
  const transferId = String(formData.get("transferId") ?? "");
  const receivedById = String(formData.get("receivedById") ?? "") || undefined;
  await receiveTransfer(transferId, receivedById);
}

export async function cancelTransferAction(formData: FormData) {
  const transferId = String(formData.get("transferId") ?? "");
  await cancelTransfer(transferId);
}

async function receiveTransfer(transferId: string, receivedById?: string) {
  const transfer = await db.transfer.findUniqueOrThrow({
    where: { id: transferId },
    include: { lines: true },
  });

  if (transfer.status === "RECEIVED") {
    return;
  }

  await db.$transaction([
    ...transfer.lines.flatMap((line) => [
      db.inventoryTransaction.create({
        data: {
          itemId: line.itemId,
          siteId: transfer.fromSiteId,
          type: "TRANSFER_OUT",
          quantity: -Math.abs(line.quantity),
          unitCost: line.unitCost,
          totalValue:
            line.unitCost != null ? -Math.abs(line.quantity) * line.unitCost : null,
          transferId: transfer.id,
          employeeId: receivedById,
        },
      }),
      db.inventoryTransaction.create({
        data: {
          itemId: line.itemId,
          siteId: transfer.toSiteId,
          type: "TRANSFER_IN",
          quantity: Math.abs(line.quantity),
          unitCost: line.unitCost,
          totalValue:
            line.unitCost != null ? Math.abs(line.quantity) * line.unitCost : null,
          transferId: transfer.id,
          employeeId: receivedById,
        },
      }),
    ]),
    db.transfer.update({
      where: { id: transferId },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
        receivedById: receivedById ?? undefined,
      },
    }),
  ]);

  revalidatePath("/transfers");
  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/inventory");
}

async function cancelTransfer(transferId: string) {
  await db.transfer.update({
    where: { id: transferId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/transfers");
  revalidatePath(`/transfers/${transferId}`);
}
