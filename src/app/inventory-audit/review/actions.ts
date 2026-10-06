"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { IaAdjustmentTarget } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { parseFlexibleDate } from "@/lib/ia/dates";
import { reviewFinding, setAdjustment } from "@/lib/ia/audits";
import { CAN_RUN_AUDITS } from "@/lib/ia/workflow";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
// Where to land afterwards: only ever back inside the audit module.
const back = (f: FormData, fallback: string) => {
  const b = text(f, "back");
  return b.startsWith("/inventory-audit/") && !b.startsWith("//") ? b : fallback;
};

// One finding's row on the review screen.
export async function saveReview(formData: FormData) {
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) throw new Error("Only an audit manager can review findings.");
  const findingId = text(formData, "findingId");
  const dueRaw = text(formData, "dueDate");
  const target = text(formData, "adjustmentTarget");

  const r = await reviewFinding(
    findingId,
    {
      categoryId: text(formData, "categoryId") || null,
      departmentId: text(formData, "departmentId") || undefined,
      assignedToId: text(formData, "assignedToId") || null,
      dueDate: dueRaw ? parseFlexibleDate(dueRaw) : null,
      adjustmentTarget: (["SYSTEM", "LABEL", "BOTH"].includes(target) ? target : null) as IaAdjustmentTarget | null,
      adjustmentStatus: text(formData, "adjustmentNeeded") === "no" ? "NOT_NEEDED" : "PENDING",
      adjustmentReasonId: formData.has("adjustmentReasonId") ? text(formData, "adjustmentReasonId") || null : undefined,
      markReviewed: true,
    },
    { userId: me.userId }
  );
  if (!r.ok) throw new Error(r.error);
  revalidatePath("/inventory-audit", "layout");
  redirect(back(formData, "/inventory-audit/audits"));
}

export async function markAllReviewed(formData: FormData) {
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) throw new Error("Only an audit manager can review findings.");
  const auditId = text(formData, "auditId");
  await db.iaFinding.updateMany({
    where: { auditId, needsReview: true },
    data: { needsReview: false, reviewedAt: new Date(), reviewedById: me.userId },
  });
  revalidatePath("/inventory-audit", "layout");
  redirect(`/inventory-audit/review/${auditId}`);
}

export async function setAdjustmentStatus(formData: FormData) {
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) throw new Error("Only an audit manager can update adjustments.");
  const status = text(formData, "status");
  if (!["PENDING", "APPLIED", "NOT_NEEDED"].includes(status)) throw new Error("Unknown adjustment status.");
  const r = await setAdjustment(text(formData, "findingId"), status as "PENDING" | "APPLIED" | "NOT_NEEDED", { userId: me.userId });
  if (!r.ok) throw new Error(r.error);
  revalidatePath("/inventory-audit", "layout");
  redirect(back(formData, "/inventory-audit/audits"));
}
