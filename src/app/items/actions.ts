"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MaterialType } from "@prisma/client";

export type CreateItemState = { error?: string } | null;

export async function createItem(
  _prevState: CreateItemState,
  formData: FormData
): Promise<CreateItemState> {
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const defaultUomId = String(formData.get("defaultUomId") ?? "");
  const materialType = String(formData.get("materialType") ?? "NA") as MaterialType;
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const genericName = String(formData.get("genericName") ?? "").trim() || null;
  const variant = String(formData.get("variant") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;

  if (!name || !categoryId || !defaultUomId) {
    return { error: "Name, category, and unit of measure are required." };
  }

  try {
    await db.item.create({
      data: {
        name,
        categoryId,
        defaultUomId,
        materialType,
        brand,
        genericName,
        variant,
        size,
        sku,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `An item named "${name}" (or with that SKU) already exists.` };
    }
    return { error: "Could not create item. Please try again." };
  }

  revalidatePath("/items");
  redirect("/items");
}

// Retiring only proceeds when the item has zero on-hand across every site —
// otherwise there'd be real inventory left pointing at a retired item with
// no way to transact it further. Reactivating has no such guard.
export async function setItemActive(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!itemId) return;

  if (!isActive) {
    const { _sum } = await db.inventoryTransaction.aggregate({
      where: { itemId },
      _sum: { quantity: true },
    });
    if ((_sum.quantity ?? 0) !== 0) return;
  }

  await db.item.update({ where: { id: itemId }, data: { isActive } });
  revalidatePath("/items");
}

export type UpdateItemState = { error?: string } | null;

export async function updateItem(
  _prevState: UpdateItemState,
  formData: FormData
): Promise<UpdateItemState> {
  const itemId = String(formData.get("itemId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const defaultUomId = String(formData.get("defaultUomId") ?? "");
  const defaultVendorId = String(formData.get("defaultVendorId") ?? "") || null;
  const materialType = String(formData.get("materialType") ?? "NA") as MaterialType;
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const genericName = String(formData.get("genericName") ?? "").trim() || null;
  const variant = String(formData.get("variant") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";

  if (!itemId || !name || !categoryId || !defaultUomId) {
    return { error: "Name, category, and unit of measure are required." };
  }

  try {
    await db.item.update({
      where: { id: itemId },
      data: {
        name,
        categoryId,
        defaultUomId,
        defaultVendorId,
        materialType,
        brand,
        genericName,
        variant,
        size,
        sku,
        isActive,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `An item named "${name}" (or with that SKU) already exists.` };
    }
    return { error: "Could not update item. Please try again." };
  }

  revalidatePath("/items");
  redirect("/items");
}
