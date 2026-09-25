"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  if (!employeeId || !name) {
    return { error: "Name is required." };
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { name, initials, siteId, isActive },
  });

  revalidatePath("/employees");
  redirect("/employees");
}
