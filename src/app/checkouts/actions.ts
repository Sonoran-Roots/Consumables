"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseCheckoutForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isReturn = formData.get("isReturn") === "on" || formData.get("isReturn") === "true";

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantity").map(Number);

  const lines = itemIds
    .map((itemId, i) => ({ itemId, quantity: quantities[i] }))
    .filter((l) => l.itemId && l.quantity > 0);

  return { siteId, employeeId, purpose, department, notes, isReturn, lines };
}

async function postCheckout(parsed: ReturnType<typeof parseCheckoutForm>) {
  const { siteId, employeeId, purpose, department, notes, isReturn, lines } = parsed;

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

  return event;
}

export type CreateCheckoutState = { error?: string } | null;

export async function createCheckout(
  _prevState: CreateCheckoutState,
  formData: FormData
): Promise<CreateCheckoutState> {
  const parsed = parseCheckoutForm(formData);

  if (!parsed.siteId || !parsed.employeeId) {
    return { error: "Please choose a site and the employee checking items out." };
  }
  if (parsed.lines.length === 0) {
    return { error: "Add at least one item with a quantity greater than zero." };
  }

  await postCheckout(parsed);

  revalidatePath("/checkouts");
  revalidatePath("/inventory");
  redirect("/checkouts");
}

export type KioskCheckoutState =
  | { error: string; success?: undefined }
  | { success: true; itemCount: number; error?: undefined }
  | null;

// Same posting logic as createCheckout, but returns a result instead of
// redirecting — the kiosk stays on-screen so the next person can log their
// checkout immediately, rather than landing on the full desktop /checkouts
// list.
export async function logKioskCheckout(
  _prevState: KioskCheckoutState,
  formData: FormData
): Promise<KioskCheckoutState> {
  const parsed = parseCheckoutForm(formData);

  if (!parsed.siteId || !parsed.employeeId) {
    return { error: "Pick a site and who's checking out." };
  }
  if (parsed.lines.length === 0) {
    return { error: "Add at least one item first." };
  }

  await postCheckout(parsed);

  revalidatePath("/checkouts");
  revalidatePath("/inventory");
  return { success: true, itemCount: parsed.lines.length };
}

export type UpdateCheckoutState = { error?: string } | null;

export async function updateCheckout(
  _prevState: UpdateCheckoutState,
  formData: FormData
): Promise<UpdateCheckoutState> {
  const checkoutId = String(formData.get("checkoutId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isReturn = formData.get("isReturn") === "on";

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantity").map(Number);

  if (!checkoutId || !siteId || !employeeId) {
    return { error: "Please choose a site and the employee checking items out." };
  }

  const lines = itemIds
    .map((itemId, i) => ({ itemId, quantity: quantities[i] }))
    .filter((l) => l.itemId && l.quantity > 0);

  if (lines.length === 0) {
    return { error: "Add at least one item with a quantity greater than zero." };
  }

  // Ledger rows post immediately at checkout creation (no separate
  // "finalize" step), so every edit deletes and reposts the linked
  // CHECKOUT/CHECKOUT_RETURN rows to match the updated values.
  await db.$transaction([
    db.checkoutEvent.update({
      where: { id: checkoutId },
      data: { siteId, employeeId, purpose, department, notes, isReturn },
    }),
    db.checkoutLine.deleteMany({ where: { checkoutEventId: checkoutId } }),
    db.checkoutLine.createMany({
      data: lines.map((l) => ({ checkoutEventId: checkoutId, ...l })),
    }),
    db.inventoryTransaction.deleteMany({ where: { checkoutEventId: checkoutId } }),
    ...lines.map((line) =>
      db.inventoryTransaction.create({
        data: {
          itemId: line.itemId,
          siteId,
          type: isReturn ? ("CHECKOUT_RETURN" as const) : ("CHECKOUT" as const),
          quantity: isReturn ? Math.abs(line.quantity) : -Math.abs(line.quantity),
          checkoutEventId: checkoutId,
          employeeId,
        },
      })
    ),
  ]);

  revalidatePath("/checkouts");
  revalidatePath("/inventory");
  redirect("/checkouts");
}
