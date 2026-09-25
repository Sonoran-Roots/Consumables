"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  computeReconciliationLines,
  type LineComputation,
} from "@/lib/reconciliation-compute";

async function writeLines(reconciliationId: string, lines: LineComputation[]) {
  await db.$transaction([
    db.reconciliationLine.deleteMany({ where: { reconciliationId } }),
    db.reconciliationLine.createMany({
      data: lines.map((l) => ({ reconciliationId, ...l })),
    }),
  ]);
}

export type CreateReconciliationState = { error?: string } | null;

export async function createReconciliation(
  _prevState: CreateReconciliationState,
  formData: FormData
): Promise<CreateReconciliationState> {
  const siteId = String(formData.get("siteId") ?? "");
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!siteId || !periodStartRaw || !periodEndRaw) {
    return { error: "Site, period start, and period end are required." };
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "Invalid period dates." };
  }
  if (periodEnd <= periodStart) {
    return { error: "Period end must be after period start." };
  }

  const reconciliation = await db.inventoryReconciliation.create({
    data: { siteId, periodStart, periodEnd, notes },
  });

  const lines = await computeReconciliationLines(siteId, periodStart, periodEnd);
  await writeLines(reconciliation.id, lines);

  revalidatePath("/reconciliation");
  redirect(`/reconciliation/${reconciliation.id}`);
}

// Creates one OPEN reconciliation per active site for the same period in a
// single action — month-end close otherwise means repeating the same form
// 19 times.
export async function createReconciliationForAllSites(formData: FormData) {
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  if (!periodStartRaw || !periodEndRaw) return;

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) return;
  if (periodEnd <= periodStart) return;

  const sites = await db.site.findMany({ where: { isActive: true } });

  for (const site of sites) {
    const reconciliation = await db.inventoryReconciliation.create({
      data: { siteId: site.id, periodStart, periodEnd },
    });
    const lines = await computeReconciliationLines(site.id, periodStart, periodEnd);
    await writeLines(reconciliation.id, lines);
  }

  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}

export async function refreshReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });
  if (reconciliation.status === "CLOSED") return;

  const lines = await computeReconciliationLines(
    reconciliation.siteId,
    reconciliation.periodStart,
    reconciliation.periodEnd
  );
  await writeLines(reconciliationId, lines);

  revalidatePath(`/reconciliation/${reconciliationId}`);
}

export type CloseReconciliationState = { error?: string } | null;

// Gated on a finalized Audit for the same site being linked — the physical
// count happens in the Audit screens; this just verifies one backs the
// close instead of re-implementing counting here.
export async function closeReconciliation(
  _prevState: CloseReconciliationState,
  formData: FormData
): Promise<CloseReconciliationState> {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  const closedById = String(formData.get("closedById") ?? "") || null;
  if (!reconciliationId) return { error: "Missing reconciliation." };

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
    include: { audit: true },
  });
  if (reconciliation.status === "CLOSED") return null;

  if (!reconciliation.audit) {
    return { error: "Link a finalized audit for this site before closing." };
  }
  if (reconciliation.audit.status === "CANCELLED") {
    return { error: "The linked audit was cancelled — link a different, finalized one." };
  }
  if (reconciliation.audit.status !== "FINALIZED") {
    return {
      error: "The linked audit hasn't been finalized yet — finish counting and finalize it first.",
    };
  }

  // Final recompute right before freezing, so the snapshot reflects
  // anything entered right up to close time (including the audit's own
  // discrepancy postings).
  const lines = await computeReconciliationLines(
    reconciliation.siteId,
    reconciliation.periodStart,
    reconciliation.periodEnd
  );
  await writeLines(reconciliationId, lines);

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { status: "CLOSED", closedAt: new Date(), closedById },
  });

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
  redirect(`/reconciliation/${reconciliationId}`);
}

export type LinkAuditState = { error?: string } | null;

export async function linkAudit(
  _prevState: LinkAuditState,
  formData: FormData
): Promise<LinkAuditState> {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  const auditId = String(formData.get("auditId") ?? "") || null;
  if (!reconciliationId) return { error: "Missing reconciliation." };

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });

  if (auditId) {
    const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId } });
    if (audit.siteId !== reconciliation.siteId) {
      return { error: "That audit is for a different site." };
    }
    if (audit.status === "CANCELLED") {
      return { error: "That audit was cancelled and can't back a close." };
    }
  }

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { auditId },
  });

  revalidatePath(`/reconciliation/${reconciliationId}`);
  redirect(`/reconciliation/${reconciliationId}`);
}

// Starts a fresh audit for this reconciliation's site (same snapshot-based
// creation as the standalone "New audit" flow) and links it immediately, so
// the user lands on the audit ready to start counting.
export async function startAuditForReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });

  const grouped = await db.inventoryTransaction.groupBy({
    by: ["itemId"],
    where: { siteId: reconciliation.siteId },
    _sum: { quantity: true },
  });
  const nonZero = grouped.filter((g) => (g._sum.quantity ?? 0) !== 0);

  const audit = await db.audit.create({
    data: {
      siteId: reconciliation.siteId,
      auditDate: reconciliation.periodEnd,
      lines: {
        create: nonZero.map((g) => ({
          itemId: g.itemId,
          systemQtyAtAudit: g._sum.quantity ?? 0,
        })),
      },
    },
  });

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { auditId: audit.id },
  });

  revalidatePath(`/reconciliation/${reconciliationId}`);
  redirect(`/audits/${audit.id}`);
}

// Deliberately unlocks a closed period for correction. The frozen numbers
// stay as they are until the next refresh/close — reopening alone doesn't
// recompute anything.
export async function reopenReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { status: "OPEN", closedAt: null, closedById: null },
  });

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
}

// Abandons an open reconciliation — e.g. a test/dev-only run. Only allowed
// pre-close, since a closed one is a real frozen snapshot; use delete for
// that instead if it genuinely needs to go away.
export async function cancelReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });
  if (reconciliation.status !== "OPEN") return;

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
}

export type UpdateReconciliationHeaderState = { error?: string } | null;

export async function updateReconciliationHeader(
  _prevState: UpdateReconciliationHeaderState,
  formData: FormData
): Promise<UpdateReconciliationHeaderState> {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!reconciliationId || !siteId || !periodStartRaw || !periodEndRaw) {
    return { error: "Site, period start, and period end are required." };
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "Invalid period dates." };
  }
  if (periodEnd <= periodStart) {
    return { error: "Period end must be after period start." };
  }

  const reconciliation = await db.inventoryReconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
  });

  if (reconciliation.status === "CLOSED") {
    // Notes are safe metadata and stay editable regardless of status; the
    // site/period (and therefore the frozen numbers) require reopening
    // first, same as any other change to a closed snapshot.
    await db.inventoryReconciliation.update({
      where: { id: reconciliationId },
      data: { notes },
    });
    revalidatePath("/reconciliation");
    revalidatePath(`/reconciliation/${reconciliationId}`);
    redirect(`/reconciliation/${reconciliationId}`);
  }

  await db.inventoryReconciliation.update({
    where: { id: reconciliationId },
    data: { siteId, periodStart, periodEnd, notes },
  });

  const lines = await computeReconciliationLines(siteId, periodStart, periodEnd);
  await writeLines(reconciliationId, lines);

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${reconciliationId}`);
  redirect(`/reconciliation/${reconciliationId}`);
}

export async function deleteReconciliation(formData: FormData) {
  const reconciliationId = String(formData.get("reconciliationId") ?? "");
  if (!reconciliationId) return;

  await db.inventoryReconciliation.delete({ where: { id: reconciliationId } });
  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}
