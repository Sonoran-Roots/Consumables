"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { digestPin, PIN_PATTERN } from "@/lib/pin";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type KioskPinResult = { ok: true } | { ok: false; error: string };

const PIN_TAKEN = "That PIN is already taken by someone else — pick a different one.";

// Everything under /kiosk runs on the tablet's own location login (or a
// person's own login) — actions here refuse to run without a session, same
// as the pages themselves.
async function requireSession() {
  return auth.api.getSession({ headers: await headers() });
}

// The PIN IS the kiosk identity — there's no name picker. Digest lookup
// (Employee.pinDigest is unique) finds the one active employee it belongs to.
async function findEmployeeByPin(pin: string) {
  if (!PIN_PATTERN.test(pin)) return null;
  return db.employee.findFirst({
    where: { pinDigest: digestPin(pin), isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      user: { select: { role: true, isPurchasingTeam: true } },
    },
  });
}

async function pinInUse(pin: string): Promise<boolean> {
  const taken = await db.employee.findUnique({
    where: { pinDigest: digestPin(pin) },
    select: { id: true },
  });
  return taken != null;
}

export type CreateKioskUserResult =
  | { ok: true; employee: { id: string; name: string } }
  | { ok: false; error: string };

// Lets a brand-new person add themselves at the kiosk: name + their own PIN,
// nothing else. Always role USER (no PIN-reset authority) and never linked
// to a login — an admin can give them app access or deactivate them later
// from the Employees page. (People who sign up for the app itself get their
// Employee + PIN in that same step — see registerAccount.) Still needs the
// kiosk tablet's own signed-in session, like everything else under /kiosk.
export async function createKioskUser(
  name: string,
  pin: string,
  siteId: string | null
): Promise<CreateKioskUserResult> {
  if (!(await requireSession())) return { ok: false, error: "This kiosk isn't signed in." };

  const cleanName = name.replace(/\s+/g, " ").trim();
  if (cleanName.length < 2) return { ok: false, error: "Enter your full name." };
  if (cleanName.length > 60) return { ok: false, error: "That name is too long." };
  if (!PIN_PATTERN.test(pin)) return { ok: false, error: "PIN must be 4 digits." };

  const existing = await db.employee.findFirst({
    where: { name: { equals: cleanName, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error:
        "Someone with that name is already on the list — go back and tap “Forgot your PIN?” to get into your account.",
    };
  }
  if (await pinInUse(pin)) return { ok: false, error: PIN_TAKEN };

  const site = siteId
    ? await db.site.findUnique({ where: { id: siteId }, select: { id: true } })
    : null;

  try {
    const employee = await db.employee.create({
      data: { name: cleanName, siteId: site?.id ?? null, pinDigest: digestPin(pin) },
      select: { id: true, name: true },
    });
    revalidatePath("/employees");
    return { ok: true, employee };
  } catch (e) {
    // Lost a race for the same PIN between the check above and the insert.
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: PIN_TAKEN };
    throw e;
  }
}

// Sets a PIN for an employee who has none (never set one, or it was just
// cleared) — the tail end of "Forgot your PIN?" at the kiosk. Refuses if a
// PIN already exists, so this can't be used to overwrite someone's live PIN;
// clearing one first takes an admin (desktop) or a manager's approval
// (approveKioskPinReset).
export async function setKioskPin(employeeId: string, pin: string): Promise<KioskPinResult> {
  if (!(await requireSession())) return { ok: false, error: "This kiosk isn't signed in." };
  if (!PIN_PATTERN.test(pin)) return { ok: false, error: "PIN must be 4 digits." };

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { pinDigest: true, isActive: true },
  });
  if (!employee || !employee.isActive) return { ok: false, error: "Employee not found." };
  if (employee.pinDigest) return { ok: false, error: "That person already has a PIN." };
  if (await pinInUse(pin)) return { ok: false, error: PIN_TAKEN };

  try {
    await db.employee.update({ where: { id: employeeId }, data: { pinDigest: digestPin(pin) } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: PIN_TAKEN };
    throw e;
  }
  return { ok: true };
}

// Lets a MANAGER/ADMIN clear a coworker's forgotten PIN right at the kiosk,
// no desktop app needed. The approver isn't picked from a list — their own
// PIN identifies them, same as everywhere else on the kiosk — and their role
// (kiosk role, or desktop-app role for people with a purchasing-team login)
// decides whether that counts.
export async function approveKioskPinReset(
  targetEmployeeId: string,
  approverPin: string
): Promise<KioskPinResult> {
  if (!(await requireSession())) return { ok: false, error: "This kiosk isn't signed in." };
  if (!targetEmployeeId) return { ok: false, error: "Pick whose PIN to reset." };
  if (!PIN_PATTERN.test(approverPin)) return { ok: false, error: "PIN must be 4 digits." };

  const approver = await findEmployeeByPin(approverPin);
  if (!approver) return { ok: false, error: "PIN not recognized." };
  if (approver.id === targetEmployeeId) {
    return { ok: false, error: "Someone else has to approve this, not you." };
  }
  const canApprove =
    approver.role !== "USER" ||
    (approver.user?.isPurchasingTeam === true && approver.user.role !== "USER");
  if (!canApprove) return { ok: false, error: "That PIN doesn't belong to a manager or admin." };

  await db.employee.update({ where: { id: targetEmployeeId }, data: { pinDigest: null } });
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
  | { ok: false; error: string }
  | { ok: true; itemCount: number; employeeName: string };

// Same posting logic as createCheckout, but for the kiosk: no employee is
// passed in. Whoever's PIN is entered when they tap "Log checkout" IS the
// employee the log is assigned to. Returns a result instead of redirecting
// so the kiosk stays on-screen for the next person.
const KIOSK_MAX_QUANTITY = 999_999;

export async function logKioskCheckout(input: {
  siteId: string;
  isReturn: boolean;
  lines: { itemId: string; quantity: number }[];
  pin: string;
}): Promise<KioskCheckoutState> {
  if (!(await requireSession())) return { ok: false, error: "This kiosk isn't signed in." };

  const lines = input.lines.filter((l) => l.itemId && l.quantity > 0);
  if (!input.siteId) return { ok: false, error: "Pick a site first." };
  if (lines.length === 0) return { ok: false, error: "Add at least one item first." };
  // Quantities can be typed on the kiosk, so don't trust the client's number.
  if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity > KIOSK_MAX_QUANTITY)) {
    return {
      ok: false,
      error: `Quantities must be whole numbers up to ${KIOSK_MAX_QUANTITY.toLocaleString("en-US")}.`,
    };
  }

  const employee = await findEmployeeByPin(input.pin);
  if (!employee) return { ok: false, error: "PIN not recognized." };

  await postCheckout({
    siteId: input.siteId,
    employeeId: employee.id,
    purpose: null,
    department: null,
    notes: null,
    isReturn: input.isReturn,
    lines,
  });

  revalidatePath("/checkouts");
  revalidatePath("/inventory");
  return { ok: true, itemCount: lines.length, employeeName: employee.name };
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
