"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { CAN_CONFIGURE } from "@/lib/ia/workflow";

const BACK = "/inventory-audit/settings";
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (message?: string): never => {
  revalidatePath("/inventory-audit", "layout");
  redirect(message ? `${BACK}?error=${encodeURIComponent(message)}` : BACK);
};

// "a, b ,c" -> ["a","b","c"]
const aliasesOf = (f: FormData) =>
  text(f, "aliases").split(",").map((s) => s.trim()).filter(Boolean);

async function guard() {
  if (!(await getAuditSession(CAN_CONFIGURE))) throw new Error("Only an Inventory Audit admin can change settings.");
}

const isUnique = (e: unknown) => (e as { code?: string })?.code === "P2002";

export async function saveFacility(formData: FormData) {
  await guard();
  const id = text(formData, "id"), name = text(formData, "name");
  if (!name) return done("A facility needs a name.");
  const data = { name, aliases: aliasesOf(formData), isActive: formData.get("isActive") === "on" || !id };
  try {
    if (id) await db.iaFacility.update({ where: { id }, data });
    else await db.iaFacility.create({ data });
  } catch (e) {
    return done(isUnique(e) ? `A facility named "${name}" already exists.` : "Couldn't save that facility.");
  }
  return done();
}

export async function saveDepartment(formData: FormData) {
  await guard();
  const id = text(formData, "id"), name = text(formData, "name");
  if (!name) return done("A department needs a name.");
  const data = { name, aliases: aliasesOf(formData), isActive: formData.get("isActive") === "on" || !id };
  try {
    if (id) await db.iaDepartment.update({ where: { id }, data });
    else await db.iaDepartment.create({ data });
  } catch (e) {
    return done(isUnique(e) ? `A department named "${name}" already exists.` : "Couldn't save that department.");
  }
  return done();
}

export async function saveCategory(formData: FormData) {
  await guard();
  const id = text(formData, "id"), name = text(formData, "name"), findingTypeId = text(formData, "findingTypeId");
  if (!name) return done("A category needs a name.");
  if (!findingTypeId) return done("Pick the finding type (impact level) this category belongs to.");
  const data = {
    name,
    findingTypeId,
    sortOrder: Number(text(formData, "sortOrder")) || 0,
    isActive: formData.get("isActive") === "on" || !id,
  };
  try {
    if (id) await db.iaFindingCategory.update({ where: { id }, data });
    else await db.iaFindingCategory.create({ data });
  } catch (e) {
    return done(isUnique(e) ? `A category named "${name}" already exists.` : "Couldn't save that category.");
  }
  return done();
}

export async function saveFindingType(formData: FormData) {
  await guard();
  const id = text(formData, "id"), name = text(formData, "name");
  if (!name) return done("A finding type needs a name.");
  const daysRaw = text(formData, "defaultDueDays");
  const days = daysRaw === "" ? null : Number(daysRaw);
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
    return done("Default due days must be a whole number from 0 to 365 (or blank for none).");
  }
  const data = {
    name,
    aliases: aliasesOf(formData),
    defaultDueDays: days,
    sortOrder: Number(text(formData, "sortOrder")) || 0,
    isActive: formData.get("isActive") === "on" || !id,
  };
  try {
    if (id) await db.iaFindingType.update({ where: { id }, data });
    else await db.iaFindingType.create({ data });
  } catch (e) {
    return done(isUnique(e) ? `A finding type named "${name}" already exists.` : "Couldn't save that finding type.");
  }
  return done();
}
