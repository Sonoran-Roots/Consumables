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

// Lets an auditor add a line for an item that isn't already on the audit —
// e.g. something physically on the shelf that the system currently shows
// at zero, which a "count everything" audit needs to be able to catch.
export async function addAuditLine(formData: FormData) {
  const auditId = String(formData.get("auditId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!auditId || !itemId) return;

  const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId } });
  if (audit.status === "FINALIZED") return;

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

export async function updateAuditCounts(formData: FormData) {
  const auditId = String(formData.get("auditId") ?? "");
  const intent = String(formData.get("intent") ?? "save");

  const audit = await db.audit.findUniqueOrThrow({
    where: { id: auditId },
    include: { lines: true },
  });
  if (audit.status === "FINALIZED") return;

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

  if (intent === "finalize") {
    const discrepancies = updates.filter(
      (u) => u.countedQty != null && u.countedQty !== u.systemQtyAtAudit
    );

    await db.$transaction([
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
