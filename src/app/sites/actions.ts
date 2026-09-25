"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SiteType } from "@prisma/client";

export type CreateBookState = { error?: string } | null;

export async function createBook(
  _prevState: CreateBookState,
  formData: FormData
): Promise<CreateBookState> {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();

  if (!name || !code) {
    return { error: "Name and code are required." };
  }

  try {
    await db.book.create({ data: { name, code } });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A book named "${name}" or coded "${code}" already exists.` };
    }
    return { error: "Could not create book. Please try again." };
  }

  revalidatePath("/sites");
  redirect("/sites");
}

export type CreateSiteState = { error?: string } | null;

export async function createSite(
  _prevState: CreateSiteState,
  formData: FormData
): Promise<CreateSiteState> {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const bookId = String(formData.get("bookId") ?? "");
  const type = String(formData.get("type") ?? "FACILITY") as SiteType;
  const isStaging = formData.get("isStaging") === "on";
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name || !code || !bookId) {
    return { error: "Name, code, and book are all required." };
  }

  try {
    await db.site.create({
      data: { name, code, bookId, type, isStaging, address },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A site coded "${code}" already exists.` };
    }
    return { error: "Could not create site. Please try again." };
  }

  revalidatePath("/sites");
  redirect("/sites");
}

export type UpdateSiteState = { error?: string } | null;

export async function updateSite(
  _prevState: UpdateSiteState,
  formData: FormData
): Promise<UpdateSiteState> {
  const siteId = String(formData.get("siteId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const bookId = String(formData.get("bookId") ?? "");
  const type = String(formData.get("type") ?? "FACILITY") as SiteType;
  const isStaging = formData.get("isStaging") === "on";
  const isActive = formData.get("isActive") === "on";
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!siteId || !name || !code || !bookId) {
    return { error: "Name, code, and book are all required." };
  }

  try {
    await db.site.update({
      where: { id: siteId },
      data: { name, code, bookId, type, isStaging, isActive, address },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { error: `A site coded "${code}" already exists.` };
    }
    return { error: "Could not update site. Please try again." };
  }

  revalidatePath("/sites");
  redirect("/sites");
}

export async function setSiteActive(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!siteId) return;

  await db.site.update({ where: { id: siteId }, data: { isActive } });
  revalidatePath("/sites");
}
