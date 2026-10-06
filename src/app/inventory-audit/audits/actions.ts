"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { IaAuditType } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { parseFlexibleDate } from "@/lib/ia/dates";
import { MAX_FILE_BYTES } from "@/lib/ia/csv";
import { parseAuditLines } from "@/lib/ia/audit-import";
import { clearDiscrepancy, completeAudit, recordLine, reopenAudit, type RecordInput, type RecordResult } from "@/lib/ia/audits";
import { CAN_ENTER_FINDINGS, CAN_CONFIGURE } from "@/lib/ia/workflow";

export type NewAuditState = { error?: string } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function createAudit(_prev: NewAuditState, formData: FormData): Promise<NewAuditState> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { error: "Only the inventory team can start an audit." };

  const name = text(formData, "name");
  const auditType = String(formData.get("auditType") ?? "");
  const facilityId = String(formData.get("facilityId") ?? "");
  const departmentId = String(formData.get("defaultDepartmentId") ?? "");
  const auditDate = parseFlexibleDate(String(formData.get("auditDate") ?? ""));
  if (!name) return { error: "Give the audit a name." };
  if (!["PRODUCT", "WASTE_LOG", "PLANT"].includes(auditType)) return { error: "Choose the audit type." };
  if (!facilityId) return { error: "Choose the facility." };
  if (!departmentId) return { error: "Choose the department findings from this audit are attributed to — it can be changed per finding later." };
  if (!auditDate) return { error: "Enter the audit date." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose the CSV file of lines to audit." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 3.8 MB — split it by room or product group and start one audit per part." };

  const parsed = parseAuditLines(await file.text());
  if (parsed.error) return { error: parsed.error };

  const audit = await db.iaAudit.create({
    data: {
      name, auditType: auditType as IaAuditType, auditDate, facilityId, defaultDepartmentId: departmentId,
      auditors: text(formData, "auditors"), notes: text(formData, "notes"), sourceFile: file.name.slice(0, 200), createdById: me.userId,
    },
    select: { id: true },
  });
  try {
    for (let i = 0; i < parsed.lines.length; i += 2000) {
      await db.iaAuditLine.createMany({ data: parsed.lines.slice(i, i + 2000).map((l) => ({ ...l, auditId: audit.id })) });
    }
  } catch (e) {
    await db.iaAudit.delete({ where: { id: audit.id } }); // don't leave a half-loaded audit behind
    return { error: `Couldn't load the lines: ${(e as Error).message}` };
  }
  revalidatePath("/inventory-audit", "layout");
  redirect(`/inventory-audit/audits/${audit.id}`);
}

export async function saveLine(input: RecordInput): Promise<RecordResult> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { ok: false, error: "Only the inventory team can record counts." };
  return recordLine(input, { userId: me.userId });
}

export async function withdrawDiscrepancy(lineId: string): Promise<RecordResult> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { ok: false, error: "Only the inventory team can do that." };
  return clearDiscrepancy(lineId, { userId: me.userId });
}

export async function finishAudit(auditId: string, force = false): Promise<{ ok: true } | { ok: false; error: string; pending?: number }> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { ok: false, error: "Only the inventory team can complete an audit." };
  const r = await completeAudit(auditId, { userId: me.userId }, force);
  if (r.ok) revalidatePath("/inventory-audit", "layout");
  return r;
}

export async function reopenAuditAction(auditId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getAuditSession(CAN_CONFIGURE))) return { ok: false, error: "Only an admin can reopen a completed audit." };
  const r = await reopenAudit(auditId);
  if (r.ok) revalidatePath("/inventory-audit", "layout");
  return r;
}

export async function deleteAudit(auditId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getAuditSession(CAN_CONFIGURE))) return { ok: false, error: "Only an admin can delete an audit." };
  const findings = await db.iaFinding.count({ where: { auditId } });
  if (findings > 0) return { ok: false, error: `This audit has ${findings} finding${findings === 1 ? "" : "s"} — they'd lose their audit. Delete or resolve those first.` };
  await db.iaAudit.deleteMany({ where: { id: auditId } });
  revalidatePath("/inventory-audit", "layout");
  return { ok: true };
}
