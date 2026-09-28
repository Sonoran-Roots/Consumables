"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { roleAtLeast } from "@/lib/access";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !roleAtLeast(session.user.role as string | undefined, "ADMIN")) {
    throw new Error("Only an admin can do that.");
  }
}

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

  await db.user.update({ where: { id: userId }, data: { role, isPurchasingTeam } });
  revalidatePath("/employees");
  return { ok: true };
}

export async function resetEmployeeKioskPin(employeeId: string) {
  if (!employeeId) return;
  await db.employee.update({
    where: { id: employeeId },
    data: { pinHash: null },
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
