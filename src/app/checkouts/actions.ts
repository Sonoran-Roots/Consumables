"use server";

import { db } from "@/lib/db";
import { hashPin, verifyPinHash } from "@/lib/pin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type KioskPinResult = { ok: true } | { ok: false; error: string };

// Verifies a kiosk employee's identity against their PIN — or, if they
// don't have one yet, creates it from this entry (soft rollout: PINs are
// self-serve and set the first time an employee is used at a kiosk, not
// pre-provisioned by an admin). Reused both for the kiosk's own immediate
// PIN-entry feedback and as a server-side re-check inside logKioskCheckout,
// so the final write can't be reached with a stale/tampered identity.
export async function confirmKioskPin(
  employeeId: string,
  pin: string
): Promise<KioskPinResult> {
  if (!employeeId) return { ok: false, error: "Pick who this is first." };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN must be 4 digits." };

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { pinHash: true },
  });
  if (!employee) return { ok: false, error: "Employee not found." };

  if (!employee.pinHash) {
    await db.employee.update({
      where: { id: employeeId },
      data: { pinHash: hashPin(pin) },
    });
    return { ok: true };
  }

  if (!verifyPinHash(pin, employee.pinHash)) {
    return { ok: false, error: "Incorrect PIN." };
  }
  return { ok: true };
}

// Lets a MANAGER/ADMIN employee clear a coworker's forgotten PIN right at
// the kiosk, no desktop app needed — the approving manager proves it's
// really them with their own PIN, same as any other kiosk identity check.
export async function approveKioskPinReset(
  targetEmployeeId: string,
  approverEmployeeId: string,
  approverPin: string
): Promise<KioskPinResult> {
  if (!targetEmployeeId || !approverEmployeeId) {
    return { ok: false, error: "Pick who's approving this." };
  }
  if (approverEmployeeId === targetEmployeeId) {
    return { ok: false, error: "Someone else has to approve this, not you." };
  }
  if (!/^\d{4}$/.test(approverPin)) {
    return { ok: false, error: "PIN must be 4 digits." };
  }

  const approver = await db.employee.findUnique({
    where: { id: approverEmployeeId },
    select: { role: true, pinHash: true },
  });
  if (!approver) return { ok: false, error: "Employee not found." };
  if (approver.role === "USER") {
    return { ok: false, error: "That person can't approve PIN resets." };
  }
  if (!approver.pinHash) {
    return { ok: false, error: "That manager needs their own PIN set up first." };
  }
  if (!verifyPinHash(approverPin, approver.pinHash)) {
    return { ok: false, error: "Incorrect PIN." };
  }

  await db.employee.update({ where: { id: targetEmployeeId }, data: { pinHash: null } });
  return { ok: true };
}

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
  const pin = String(formData.get("pin") ?? "");

  if (!parsed.siteId || !parsed.employeeId) {
    return { error: "Pick a site and who's checking out." };
  }
  if (parsed.lines.length === 0) {
    return { error: "Add at least one item first." };
  }

  // Re-verify server-side even though the kiosk UI already confirmed the
  // PIN before showing the cart — this is what actually stops the final
  // write from going through under a different/stale identity, not the
  // earlier UI step by itself.
  const pinResult = await confirmKioskPin(parsed.employeeId, pin);
  if (!pinResult.ok) {
    return { error: pinResult.error };
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
