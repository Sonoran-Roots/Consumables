"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { IaAuditType } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { parseFlexibleDate } from "@/lib/ia/dates";
import { MAX_FILE_BYTES } from "@/lib/ia/csv";
import { parseAuditLines } from "@/lib/ia/audit-import";
import { cultivationType, parseCultivationLines, parseStage } from "@/lib/ia/cultivation";
import { applyCompletedCounts, type CountsResult } from "@/lib/ia/audit-counts";
import { completeAudit, recordLine, reopenAudit, type RecordInput, type RecordResult } from "@/lib/ia/audits";
import { CAN_CONFIGURE, CAN_ENTER_FINDINGS, CAN_RUN_AUDITS } from "@/lib/ia/workflow";

export type NewAuditState = { error?: string } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

// An audit manager starts the audit: where and when, who the findings go to by
// default, and the Dutchie export of what's to be audited.
export async function createAudit(_prev: NewAuditState, formData: FormData): Promise<NewAuditState> {
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) return { error: "Only an audit manager can start an audit." };

  const name = text(formData, "name");
  const facilityId = String(formData.get("facilityId") ?? "");
  const departmentId = String(formData.get("defaultDepartmentId") ?? "");
  const auditDate = parseFlexibleDate(String(formData.get("auditDate") ?? ""));
  if (!name) return { error: "Give the audit a name." };
  if (!facilityId) return { error: "Choose the location being audited." };
  if (!auditDate) return { error: "Enter the audit date." };
  if (!departmentId) return { error: "Choose the department findings go to by default — each finding can be reassigned during review." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose the Dutchie export (CSV)." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 3.8 MB — split it by room or product group and start one audit per part." };

  // A cultivation audit counts plants by batch and room, for one stage or all of them.
  const cultivation = formData.get("kind") === "cultivation";
  const stage = parseStage(String(formData.get("stage") ?? ""));
  const parsed = cultivation ? parseCultivationLines(await file.text(), stage) : parseAuditLines(await file.text());
  if (parsed.error) return { error: parsed.error };

  const audit = await db.iaAudit.create({
    data: {
      name, auditType: "PRODUCT" as IaAuditType, auditDate, facilityId, defaultDepartmentId: departmentId,
      dutchieType: cultivation ? cultivationType(stage) : ["RETAIL", "PRODUCTION", "DISTRIBUTION"].includes(String(formData.get("dutchieType"))) ? String(formData.get("dutchieType")) : null,
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

// Auditors count and flag in the moment.
export async function saveLine(input: RecordInput): Promise<RecordResult> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { ok: false, error: "Only the inventory team can record counts." };
  return recordLine(input, { userId: me.userId });
}

export async function finishAudit(auditId: string, force = false): Promise<{ ok: true } | { ok: false; error: string; pending?: number }> {
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) return { ok: false, error: "Only an audit manager can complete an audit." };
  const r = await completeAudit(auditId, { userId: me.userId }, force);
  if (r.ok) revalidatePath("/inventory-audit", "layout");
  return r;
}

export async function reopenAuditAction(auditId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getAuditSession(CAN_RUN_AUDITS))) return { ok: false, error: "Only an audit manager can reopen a completed audit." };
  const r = await reopenAudit(auditId);
  if (r.ok) revalidatePath("/inventory-audit", "layout");
  return r;
}

// Deletes the audit and its lines. Its findings are deleted with it, or (keepFindings)
// stay in the tracker without an audit.
export async function deleteAudit(auditId: string, keepFindings = false): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getAuditSession(CAN_CONFIGURE))) return { ok: false, error: "Only an admin can delete an audit." };
  await db.$transaction(async (tx) => {
    if (!keepFindings) await tx.iaFinding.deleteMany({ where: { auditId } });
    await tx.iaAudit.deleteMany({ where: { id: auditId } });
  });
  revalidatePath("/inventory-audit", "layout");
  return { ok: true };
}

export type CountsState = CountsResult | null;

// The completed Dutchie audit table (counts, times, notes, adjustment reasons)
// applied to an audit that was started from the initial table.
export async function loadCompletedCounts(_prev: CountsState, formData: FormData): Promise<CountsState> {
  const checkOnly = formData.get("checkOnly") === "on";
  const empty = (message: string): CountsResult => ({ checkOnly, matched: 0, countedOk: 0, discrepancies: 0, leftPending: 0, skippedAlreadyCounted: 0, expectedDiffers: 0, errors: [message], notes: [] });
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) return empty("Only an audit manager can load counts from Dutchie.");
  const auditId = String(formData.get("auditId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return empty("Please choose the completed Dutchie audit table (CSV).");
  if (file.size > MAX_FILE_BYTES) return empty("That file is over 3.8 MB.");

  const result = await applyCompletedCounts(
    auditId, await file.text(),
    { countUnchanged: formData.get("countUnchanged") === "on", alreadyAdjusted: formData.get("alreadyAdjusted") === "on", checkOnly },
    { userId: me.userId }
  );
  if (!checkOnly) revalidatePath("/inventory-audit", "layout");
  return result;
}
