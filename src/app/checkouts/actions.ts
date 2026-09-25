"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateCheckoutState = { error?: string } | null;

export async function createCheckout(
  _prevState: CreateCheckoutState,
  formData: FormData
): Promise<CreateCheckoutState> {
  const siteId = String(formData.get("siteId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isReturn = formData.get("isReturn") === "on";

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantity").map(Number);

  if (!siteId || !employeeId) {
    return { error: "Please choose a site and the employee checking items out." };
  }

  const lines = itemIds
    .map((itemId, i) => ({ itemId, quantity: quantities[i] }))
    .filter((l) => l.itemId && l.quantity > 0);

  if (lines.length === 0) {
    return { error: "Add at least one item with a quantity greater than zero." };
  }

  const event = await db.checkoutEvent.create({
    data: {
      siteId,
      employeeId,
      purpose,
      department,
      notes,
      isReturn,
      lines: { create: lines },
    },
  });

  await db.inventoryTransaction.createMany({
    data: lines.map((line) => ({
      itemId: line.itemId,
      siteId,
      type: isReturn ? "CHECKOUT_RETURN" : "CHECKOUT",
      quantity: isReturn ? Math.abs(line.quantity) : -Math.abs(line.quantity),
      checkoutEventId: event.id,
      employeeId,
    })),
  });

  revalidatePath("/checkouts");
  revalidatePath("/inventory");
  redirect("/checkouts");
}
