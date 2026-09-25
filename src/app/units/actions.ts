"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateUnitState = { error?: string } | null;

export async function createUnit(
  _prevState: CreateUnitState,
  formData: FormData
): Promise<CreateUnitState> {
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!code) {
    return { error: "Code is required." };
  }

  try {
    await db.unitOfMeasure.create({ data: { code, description } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A unit of measure coded "${code}" already exists.` };
    }
    return { error: "Could not create unit of measure. Please try again." };
  }

  revalidatePath("/units");
  redirect("/units");
}

export type UpdateUnitState = { error?: string } | null;

export async function updateUnit(
  _prevState: UpdateUnitState,
  formData: FormData
): Promise<UpdateUnitState> {
  const unitId = String(formData.get("unitId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!unitId || !code) {
    return { error: "Code is required." };
  }

  try {
    await db.unitOfMeasure.update({ where: { id: unitId }, data: { code, description } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A unit of measure coded "${code}" already exists.` };
    }
    return { error: "Could not update unit of measure. Please try again." };
  }

  revalidatePath("/units");
  redirect("/units");
}

export async function deleteUnit(formData: FormData) {
  const unitId = String(formData.get("unitId") ?? "");
  if (!unitId) return;

  const itemCount = await db.item.count({ where: { defaultUomId: unitId } });
  if (itemCount > 0) return;

  await db.unitOfMeasure.delete({ where: { id: unitId } });
  revalidatePath("/units");
}
