"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateCategoryState = { error?: string } | null;

export async function createCategory(
  _prevState: CreateCategoryState,
  formData: FormData
): Promise<CreateCategoryState> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const legacyCode = String(formData.get("legacyCode") ?? "").trim() || null;

  if (!name) {
    return { error: "Name is required." };
  }

  try {
    await db.category.create({ data: { name, parentId, legacyCode } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A category named "${name}" already exists.` };
    }
    return { error: "Could not create category. Please try again." };
  }

  revalidatePath("/categories");
  redirect("/categories");
}

export type UpdateCategoryState = { error?: string } | null;

export async function updateCategory(
  _prevState: UpdateCategoryState,
  formData: FormData
): Promise<UpdateCategoryState> {
  const categoryId = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const legacyCode = String(formData.get("legacyCode") ?? "").trim() || null;

  if (!categoryId || !name) {
    return { error: "Name is required." };
  }

  if (parentId === categoryId) {
    return { error: "A category cannot be its own parent." };
  }

  try {
    await db.category.update({
      where: { id: categoryId },
      data: { name, parentId, legacyCode },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A category named "${name}" already exists.` };
    }
    return { error: "Could not update category. Please try again." };
  }

  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategory(formData: FormData) {
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) return;

  const [itemCount, childCount] = await Promise.all([
    db.item.count({ where: { categoryId } }),
    db.category.count({ where: { parentId: categoryId } }),
  ]);
  if (itemCount > 0 || childCount > 0) return;

  await db.category.delete({ where: { id: categoryId } });
  revalidatePath("/categories");
}
