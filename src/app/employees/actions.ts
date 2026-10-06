"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { isAnyAdmin, isAuditRole } from "@/lib/access";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAnyAdmin(session.user as { role?: string; auditRole?: string | null })) {
    throw new Error("Only an admin can do that.");
  }
  return session;
}

// A working admin: an admin of Consumable Management, or of Inventory Audit.
// Either can open the Employees page, the only place access is managed.
const ADMIN_LOGIN = [{ role: "ADMIN" as const, isPurchasingTeam: true }, { auditRole: "ADMIN" as const }];

// Would deleting this login leave the app with no working admin? Guards
// against locking everyone out of the Employees page.
async function isLastAdminLogin(userId: string): Promise<boolean> {
  const target = await db.user.findFirst({ where: { id: userId, OR: ADMIN_LOGIN }, select: { id: true } });
  if (!target) return false;
  const others = await db.user.count({ where: { id: { not: userId }, OR: ADMIN_LOGIN } });
  return others === 0;
}

// Would changing this person's access leave nobody able to manage access?
async function removesLastAdmin(userId: string, next: { role?: string; isPurchasingTeam?: boolean; auditRole?: string | null }): Promise<boolean> {
  const cur = await db.user.findUnique({ where: { id: userId }, select: { role: true, isPurchasingTeam: true, auditRole: true } });
  if (!cur) return false;
  const was = (cur.role === "ADMIN" && cur.isPurchasingTeam) || cur.auditRole === "ADMIN";
  const merged = { ...cur, ...next };
  const will = (merged.role === "ADMIN" && merged.isPurchasingTeam) || merged.auditRole === "ADMIN";
  if (!was || will) return false;
  return (await db.user.count({ where: { id: { not: userId }, OR: ADMIN_LOGIN } })) === 0;
}
const LAST_ADMIN = "That would leave no admin — make someone else an admin first.";

export type CreateEmployeeState = { error?: string } | null;

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const name = String(formData.get("name") ?? "").trim();
  const initials = String(formData.get("initials") ?? "").trim() || null;
  const siteId = String(formData.get("siteId") ?? "") || null;

  if (!name) {
    return { error: "Name is required." };
  }

  await db.employee.create({ data: { name, initials, siteId } });

  revalidatePath("/employees");
  redirect("/employees");
}

export type AppAccessResult = { ok: true } | { ok: false; error: string };

// Admin-driven — there's no public self-serve equivalent of this (that's
// what /sign-up was, and it's meant to close once this exists). Creates the
// Better Auth login via its own server API (so the password is hashed the
// normal way), then links it to the employee and sets the access fields
// Better Auth won't accept through sign-up itself (role/isPurchasingTeam
// are input: false — see src/lib/auth.ts).
export async function createAppAccessForEmployee(
  employeeId: string,
  email: string,
  password: string,
  role: StaffRole,
  isPurchasingTeam: boolean
): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let userId: string;
  try {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { name: true },
    });
    if (!employee) return { ok: false, error: "Employee not found." };

    const result = await auth.api.signUpEmail({
      body: { email, password, name: employee.name },
    });
    userId = result.user.id;
  } catch (e) {
    const message =
      (e as { body?: { message?: string } })?.body?.message ??
      (e as Error).message ??
      "Couldn't create that account.";
    return { ok: false, error: message };
  }

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { role, isPurchasingTeam } }),
    db.employee.update({ where: { id: employeeId }, data: { userId } }),
  ]);

  revalidatePath("/employees");
  return { ok: true };
}

// Links an ALREADY-EXISTING login (one of the "Other accounts" — created
// via sign-up, or a shared kiosk account someone mistakenly wants to treat
// as a person) to this employee, instead of creating a new one. Refuses if
// that account is already linked elsewhere, since Employee.userId is
// one-to-one.
export async function linkExistingAccount(
  employeeId: string,
  email: string
): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { employee: { select: { id: true, name: true } } },
  });
  if (!user) return { ok: false, error: "No account with that email." };
  if (user.employee && user.employee.id !== employeeId) {
    return { ok: false, error: `Already linked to ${user.employee.name}.` };
  }

  await db.employee.update({ where: { id: employeeId }, data: { userId: user.id } });
  revalidatePath("/employees");
  return { ok: true };
}

export async function unlinkAppAccess(employeeId: string): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  await db.employee.update({ where: { id: employeeId }, data: { userId: null } });
  revalidatePath("/employees");
  return { ok: true };
}

export async function updateUserAccess(
  userId: string,
  role: StaffRole,
  isPurchasingTeam: boolean
): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (await removesLastAdmin(userId, { role, isPurchasingTeam })) return { ok: false, error: LAST_ADMIN };
  await db.user.update({ where: { id: userId }, data: { role, isPurchasingTeam } });
  revalidatePath("/employees");
  return { ok: true };
}

// Access to the Inventory Audit module — separate from the Consumable
// Management access above. null removes it.
export async function updateAuditAccess(
  userId: string,
  auditRole: string | null
): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (auditRole !== null && !isAuditRole(auditRole)) {
    return { ok: false, error: "Unknown audit access level." };
  }

  if (await removesLastAdmin(userId, { auditRole })) return { ok: false, error: LAST_ADMIN };
  await db.user.update({ where: { id: userId }, data: { auditRole } });
  revalidatePath("/employees");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Managing a person's login (admins only)
// ---------------------------------------------------------------------------

// Change the email they sign in with (and optionally the name on the login).
export async function updateLoginDetails(userId: string, email: string, name: string): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(cleanEmail)) return { ok: false, error: "Enter a valid email address." };
  if (!name.trim()) return { ok: false, error: "The name can't be blank." };
  const clash = await db.user.findFirst({ where: { email: cleanEmail, id: { not: userId } }, select: { id: true } });
  if (clash) return { ok: false, error: "Another account already uses that email." };
  await db.user.update({ where: { id: userId }, data: { email: cleanEmail, name: name.trim() } });
  revalidatePath("/employees");
  return { ok: true };
}

// Set a new password for them; every device they're signed in on is signed out.
export async function setLoginPassword(userId: string, password: string): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters." };
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const updated = await db.account.updateMany({ where: { userId, providerId: "credential" }, data: { password: hash } });
  if (updated.count === 0) return { ok: false, error: "That login has no password to reset." };
  await db.session.deleteMany({ where: { userId } });
  revalidatePath("/employees");
  return { ok: true };
}

export async function signOutEverywhere(userId: string): Promise<AppAccessResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await db.session.deleteMany({ where: { userId } });
  return { ok: true };
}

export type RemoveResult =
  | { ok: true; mode: "deleted" | "deactivated" }
  | { ok: false; error: string };

// Removes a person: their login (if any) is deleted, so they can't sign in
// to the app, and their PIN is cleared, so it stops working at every kiosk
// and can be reused. If they have history (checkouts, transfers, audits...)
// the Employee record itself is kept but marked inactive, so past logs still
// say who did them and reports don't break; with no history it's deleted
// outright. Either way they drop off the kiosk's "Forgot your PIN?" list.
export async function removeEmployee(employeeId: string): Promise<RemoveResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      userId: true,
      _count: {
        select: {
          inventoryTransactions: true,
          transfersRequested: true,
          transfersReceived: true,
          checkoutEvents: true,
          auditsPerformed: true,
          reconciliationsClosed: true,
        },
      },
    },
  });
  if (!employee) return { ok: false, error: "Employee not found." };

  if (employee.userId) {
    if (employee.userId === session.user.id) {
      return { ok: false, error: "You can't remove your own account." };
    }
    if (await isLastAdminLogin(employee.userId)) {
      return { ok: false, error: "That's the last admin — make someone else an admin first." };
    }
  }

  const hasHistory = Object.values(employee._count).some((n) => n > 0);

  // Login first: Employee.userId is SetNull, so the employee survives it.
  if (employee.userId) await db.user.delete({ where: { id: employee.userId } });

  if (hasHistory) {
    await db.employee.update({
      where: { id: employeeId },
      data: { isActive: false, pinDigest: null, userId: null },
    });
  } else {
    await db.employee.delete({ where: { id: employeeId } });
  }

  revalidatePath("/employees");
  return { ok: true, mode: hasHistory ? "deactivated" : "deleted" };
}

// Removes one of the "Other accounts" — a login with no employee, typically
// a shared kiosk tablet's. (People go through removeEmployee instead.)
export async function removeStandaloneAccount(userId: string): Promise<AppAccessResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (userId === session.user.id) {
    return { ok: false, error: "You can't remove your own account." };
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { employee: { select: { id: true } } },
  });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.employee) {
    return { ok: false, error: "That login belongs to an employee — remove them instead." };
  }
  if (await isLastAdminLogin(userId)) {
    return { ok: false, error: "That's the last admin — make someone else an admin first." };
  }

  await db.user.delete({ where: { id: userId } });
  revalidatePath("/employees");
  return { ok: true };
}

export async function resetEmployeeKioskPin(employeeId: string) {
  if (!employeeId) return;
  await db.employee.update({
    where: { id: employeeId },
    data: { pinDigest: null },
  });
  revalidatePath(`/employees/${employeeId}/edit`);
}

export type UpdateEmployeeState = { error?: string } | null;

export async function updateEmployee(
  _prevState: UpdateEmployeeState,
  formData: FormData
): Promise<UpdateEmployeeState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const initials = String(formData.get("initials") ?? "").trim() || null;
  const siteId = String(formData.get("siteId") ?? "") || null;
  const isActive = formData.get("isActive") === "on";
  const role = String(formData.get("role") ?? "USER") as StaffRole;

  if (!employeeId || !name) {
    return { error: "Name is required." };
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { name, initials, siteId, isActive, role },
  });

  revalidatePath("/employees");
  redirect("/employees");
}
