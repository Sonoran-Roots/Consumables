"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { IaAuditType, Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { addDays, parseFlexibleDate } from "@/lib/ia/dates";
import { transitionFinding, type ActionResult } from "@/lib/ia/findings";
import { canSeeFinding } from "@/lib/ia/scope";
import { CAN_ENTER_FINDINGS, type FindingAction } from "@/lib/ia/workflow";

export type FindingFormState = { error?: string } | null;

const AUDIT_TYPES = ["PRODUCT", "WASTE_LOG", "PLANT"];
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const number = (f: FormData, k: string) => {
  const v = text(f, k);
  return v === null || !Number.isFinite(Number(v)) ? null : Number(v);
};

// Shared by create and edit: turns the form into finding fields, or says what's wrong.
async function readForm(f: FormData): Promise<{ error: string } | { data: Omit<Prisma.IaFindingUncheckedCreateInput, "id" | "createdById">; dueDefaulted: boolean }> {
  const auditType = String(f.get("auditType") ?? "");
  const auditDate = parseFlexibleDate(String(f.get("auditDate") ?? ""));
  const facilityId = String(f.get("facilityId") ?? "");
  let findingTypeId = String(f.get("findingTypeId") ?? "");
  const categoryId = text(f, "categoryId");
  if (categoryId && !findingTypeId) {
    // A category implies its type (impact level).
    findingTypeId = (await db.iaFindingCategory.findUnique({ where: { id: categoryId }, select: { findingTypeId: true } }))?.findingTypeId ?? "";
  }
  const departmentId = String(f.get("departmentId") ?? "");
  const description = text(f, "description");

  if (!AUDIT_TYPES.includes(auditType)) return { error: "Choose the audit type." };
  if (!auditDate) return { error: "Enter the date audited." };
  if (!facilityId || !findingTypeId || !departmentId) return { error: "Facility, finding type and department are required." };
  if (!description) return { error: "Describe the finding." };

  const disposal = text(f, "disposalDate");
  const disposalDate = disposal ? parseFlexibleDate(disposal) : null;
  if (disposal && !disposalDate) return { error: "The disposal date isn't a valid date." };

  const dueRaw = text(f, "dueDate");
  let dueDate = dueRaw ? parseFlexibleDate(dueRaw) : null;
  if (dueRaw && !dueDate) return { error: "The due date isn't a valid date." };
  let dueDefaulted = false;
  if (!dueDate) {
    const type = await db.iaFindingType.findUnique({ where: { id: findingTypeId }, select: { defaultDueDays: true } });
    if (type?.defaultDueDays != null) {
      dueDate = addDays(auditDate, type.defaultDueDays);
      dueDefaulted = true;
    }
  }

  return {
    dueDefaulted,
    data: {
      auditType: auditType as IaAuditType,
      auditDate,
      auditors: text(f, "auditors"),
      facilityId,
      findingTypeId,
      categoryId,
      departmentId,
      secondDepartmentId: text(f, "secondDepartmentId"),
      description,
      product: text(f, "product"),
      batchId: text(f, "batchId"),
      pid: text(f, "pid"),
      strain: text(f, "strain"),
      quantity: number(f, "quantity"),
      unit: text(f, "unit"),
      room: text(f, "room"),
      serialNo: text(f, "serialNo"),
      reference: text(f, "reference"),
      weightGrams: number(f, "weightGrams"),
      disposalDate,
      correction: text(f, "correction"),
      monitoringNotes: text(f, "monitoringNotes"),
      dueDate,
      assignedToId: text(f, "assignedToId"),
    },
  };
}

export async function createFinding(_prev: FindingFormState, formData: FormData): Promise<FindingFormState> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { error: "Only the inventory team can log findings." };
  const parsed = await readForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const finding = await db.iaFinding.create({
    data: { ...parsed.data, createdById: me.userId, events: { create: { actorId: me.userId, kind: "CREATED", toStatus: "OPEN" } } },
    select: { id: true },
  });
  revalidatePath("/inventory-audit", "layout");
  redirect(`/inventory-audit/findings/${finding.id}`);
}

export async function updateFinding(_prev: FindingFormState, formData: FormData): Promise<FindingFormState> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { error: "Only the inventory team can edit findings." };
  const findingId = String(formData.get("findingId") ?? "");
  const existing = await db.iaFinding.findUnique({ where: { id: findingId }, select: { id: true } });
  if (!existing) return { error: "That finding no longer exists." };
  const parsed = await readForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  await db.$transaction([
    db.iaFinding.update({ where: { id: findingId }, data: parsed.data }),
    db.iaFindingEvent.create({ data: { findingId, actorId: me.userId, kind: "EDITED", note: "Details edited" } }),
  ]);
  revalidatePath("/inventory-audit", "layout");
  redirect(`/inventory-audit/findings/${findingId}`);
}

export async function changeFindingStatus(findingId: string, action: FindingAction, note: string): Promise<ActionResult> {
  const me = await getAuditSession();
  if (!me) return { ok: false, error: "You don't have access to Inventory Audit." };
  if (!(await canSeeFinding(me, findingId))) return { ok: false, error: "That finding isn't assigned to you." };
  const result = await transitionFinding(findingId, action, { userId: me.userId, role: me.role }, note);
  if (result.ok) revalidatePath("/inventory-audit", "layout");
  return result;
}

export async function addFindingNote(findingId: string, note: string): Promise<ActionResult> {
  const me = await getAuditSession();
  if (!me) return { ok: false, error: "You don't have access to Inventory Audit." };
  if (!(await canSeeFinding(me, findingId))) return { ok: false, error: "That finding isn't assigned to you." };
  const clean = note.trim();
  if (!clean) return { ok: false, error: "Write a note first." };
  await db.iaFindingEvent.create({ data: { findingId, actorId: me.userId, kind: "NOTE", note: clean } });
  revalidatePath(`/inventory-audit/findings/${findingId}`);
  return { ok: true };
}

export async function assignFinding(findingId: string, userId: string | null): Promise<ActionResult> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { ok: false, error: "Only the inventory team can assign findings." };
  if (userId) {
    const target = await db.user.findUnique({ where: { id: userId }, select: { name: true, auditRole: true } });
    if (!target || !target.auditRole) return { ok: false, error: "That person doesn't have Inventory Audit access." };
  }
  const who = userId ? (await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })) : null;
  await db.$transaction([
    db.iaFinding.update({ where: { id: findingId }, data: { assignedToId: userId } }),
    db.iaFindingEvent.create({
      data: { findingId, actorId: me.userId, kind: "ASSIGNED", note: who ? `Assigned to ${who.name || who.email}` : "Unassigned" },
    }),
  ]);
  revalidatePath("/inventory-audit", "layout");
  return { ok: true };
}
