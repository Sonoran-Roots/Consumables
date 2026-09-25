"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateAuditState = { error?: string } | null;

export async function createAudit(
  _prevState: CreateAuditState,
  formData: FormData
): Promise<CreateAuditState> {
  const siteId = String(formData.get("siteId") ?? "");
  const auditDateRaw = String(formData.get("auditDate") ?? "");
  const performedById = String(formData.get("performedById") ?? "") || null;

  if (!siteId || !auditDateRaw) {
    return { error: "Site and audit date are required." };
  }

  const auditDate = new Date(auditDateRaw);
  if (Number.isNaN(auditDate.getTime())) {
    return { error: "Invalid audit date." };
  }

  // Snapshot current on-hand per item at this site as of right now — this
  // becomes each line's "system quantity" to compare the physical count against.
  const grouped = await db.inventoryTransaction.groupBy({
    by: ["itemId"],
    where: { siteId },
    _sum: { quantity: true },
  });
  const nonZero = grouped.filter((g) => (g._sum.quantity ?? 0) !== 0);

  const audit = await db.audit.create({
    data: {
      siteId,
      auditDate,
      performedById,
      lines: {
        create: nonZero.map((g) => ({
          itemId: g.itemId,
          systemQtyAtAudit: g._sum.quantity ?? 0,
        })),
      },
    },
  });

  revalidatePath("/audits");
  redirect(`/audits/${audit.id}`);
}

export type UpdateAuditHeaderState = { error?: string } | null;

// Header fields stay editable even after finalize — e.g. the audit was
// logged against the wrong site or date by mistake. Any already-posted
// DISCREPANCY rows move with a site change so they stay attributed
// correctly; the per-line systemQtyAtAudit snapshots are left as-is
// (they're a historical snapshot, not recomputed live).
export async function updateAuditHeader(
  _prevState: UpdateAuditHeaderState,
  formData: FormData
): Promise<UpdateAuditHeaderState> {
  const auditId = String(formData.get("auditId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const auditDateRaw = String(formData.get("auditDate") ?? "");
  const performedById = String(formData.get("performedById") ?? "") || null;

  if (!auditId || !siteId || !auditDateRaw) {
    return { error: "Site and audit date are required." };
  }

  const auditDate = new Date(auditDateRaw);
  if (Number.isNaN(auditDate.getTime())) {
    return { error: "Invalid audit date." };
  }

  await db.$transaction([
    db.audit.update({
      where: { id: auditId },
      data: { siteId, auditDate, performedById },
    }),
    db.inventoryTransaction.updateMany({ where: { auditId }, data: { siteId } }),
  ]);

  revalidatePath("/audits");
  revalidatePath(`/audits/${auditId}`);
  redirect(`/audits/${auditId}`);
}

// Lets an auditor add a line for an item that isn't already on the audit —
// e.g. something physically on the shelf that the system currently shows
// at zero, which a "count everything" audit needs to be able to catch.
// Allowed even on a finalized audit, matching countedQty edits below.
export async function addAuditLine(formData: FormData) {
  const auditId = String(formData.get("auditId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!auditId || !itemId) return;

  const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId } });

  const existing = await db.auditLine.findFirst({ where: { auditId, itemId } });
  if (existing) return;

  const { _sum } = await db.inventoryTransaction.aggregate({
    where: { itemId, siteId: audit.siteId },
    _sum: { quantity: true },
  });

  await db.auditLine.create({
    data: {
      auditId,
      itemId,
      systemQtyAtAudit: _sum.quantity ?? 0,
    },
  });

  revalidatePath(`/audits/${auditId}`);
}

// Abandons an in-progress audit — e.g. a test/dev-only count that was never
// meant to be finalized. Only allowed pre-finalize, since a finalized audit
// has already posted real DISCREPANCY transactions; cancelling one that far
// along would need to reverse those, which isn't what "cancel" means here.
export async function cancelAudit(formData: FormData) {
  const auditId = String(formData.get("auditId") ?? "");
  if (!auditId) return;

  const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId } });
  if (audit.status !== "IN_PROGRESS") return;

  await db.audit.update({ where: { id: auditId }, data: { status: "CANCELLED" } });

  revalidatePath("/audits");
  revalidatePath(`/audits/${auditId}`);
}

export async function reactivateAudit(formData: FormData) {
  const auditId = String(formData.get("auditId") ?? "");
  if (!auditId) return;

  const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId } });
  if (audit.status !== "CANCELLED") return;

  await db.audit.update({ where: { id: auditId }, data: { status: "IN_PROGRESS" } });

  revalidatePath("/audits");
  revalidatePath(`/audits/${auditId}`);
}

export async function updateAuditCounts(formData: FormData) {
  const auditId = String(formData.get("auditId") ?? "");
  const intent = String(formData.get("intent") ?? "save");

  const audit = await db.audit.findUniqueOrThrow({
    where: { id: auditId },
    include: { lines: true },
  });
  const wasFinalized = audit.status === "FINALIZED";

  const updates = audit.lines.map((line) => {
    const raw = formData.get(`countedQty-${line.id}`);
    const trimmed = raw != null ? String(raw).trim() : "";
    const countedQty = trimmed !== "" ? Number(trimmed) : null;
    return {
      lineId: line.id,
      itemId: line.itemId,
      systemQtyAtAudit: line.systemQtyAtAudit,
      countedQty,
    };
  });

  await db.$transaction(
    updates.map((u) =>
      db.auditLine.update({ where: { id: u.lineId }, data: { countedQty: u.countedQty } })
    )
  );

  // Once finalized, any further count edit (not just an explicit
  // "finalize" click) re-reconciles the posted DISCREPANCY rows — delete
  // and repost them from the current counts, rather than requiring the
  // audit to be un-finalized first.
  if (intent === "finalize" || wasFinalized) {
    const discrepancies = updates.filter(
      (u) => u.countedQty != null && u.countedQty !== u.systemQtyAtAudit
    );

    await db.$transaction([
      db.inventoryTransaction.deleteMany({ where: { auditId } }),
      ...discrepancies.map((d) =>
        db.inventoryTransaction.create({
          data: {
            itemId: d.itemId,
            siteId: audit.siteId,
            type: "DISCREPANCY",
            quantity: d.countedQty! - d.systemQtyAtAudit,
            auditId: audit.id,
            employeeId: audit.performedById ?? undefined,
            notes: "Audit variance",
          },
        })
      ),
      db.audit.update({ where: { id: auditId }, data: { status: "FINALIZED" } }),
    ]);

    revalidatePath("/inventory");
  }

  revalidatePath("/audits");
  revalidatePath(`/audits/${auditId}`);
}
