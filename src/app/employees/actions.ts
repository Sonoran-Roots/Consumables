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
