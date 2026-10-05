"use server";

import { revalidatePath } from "next/cache";
import type { IaAuditType } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { MAX_FILE_BYTES } from "@/lib/ia/csv";
import { CAN_ENTER_FINDINGS } from "@/lib/ia/workflow";
import { runFindingsImport, type UploadResult } from "./import-findings";

const empty = (checkOnly: boolean, message: string): NonNullable<UploadResult> => ({
  checkOnly, created: 0, skippedNotFindings: 0, skippedDuplicates: 0, errors: [message], notes: [],
});

export async function uploadFindingsCsv(_prev: UploadResult, formData: FormData): Promise<UploadResult> {
  const checkOnly = formData.get("checkOnly") === "on";
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return empty(checkOnly, "Only the inventory team can upload findings.");

  const auditType = String(formData.get("auditType") ?? "");
  if (!["PRODUCT", "WASTE_LOG", "PLANT"].includes(auditType)) return empty(checkOnly, "Choose the audit type.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return empty(checkOnly, "Please choose a CSV file.");
  if (file.size > MAX_FILE_BYTES) return empty(checkOnly, "That file is over 3.8 MB — export just the rows with findings, or split it.");

  const result = await runFindingsImport(await file.text(), {
    auditType: auditType as IaAuditType,
    checkOnly,
    actorId: me.userId,
    confirmedMeans: formData.get("confirmedMeans") === "RESOLVED" ? "RESOLVED" : "VERIFIED",
  });
  if (!result.checkOnly && result.created > 0) revalidatePath("/inventory-audit", "layout");
  return result;
}
