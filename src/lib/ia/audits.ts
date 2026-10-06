import { db } from "@/lib/db";
import type { IaLineStatus, Prisma } from "@prisma/client";
import { addDays } from "./dates";
import { describeDiscrepancy, isMismatch, type LineView } from "./audit-rules";

// ---------------------------------------------------------------------------
// Recording a count
// ---------------------------------------------------------------------------

export type RecordResult =
  | { ok: true; line: LineView }
  | { ok: false; error: string; conflict?: { actualQty: number | null; countedByName: string | null } };

export type RecordInput = {
  lineId: string;
  actualQty: number | null; // null = no count (flag-only, or clearing a count)
  version: string;
  force?: boolean;
  // Present when documenting a discrepancy (a mismatch, or a manual flag on a line that matches).
  discrepancy?: { categoryId: string; note: string | null };
};

const lineInclude = {
  countedBy: { select: { name: true, email: true } },
  finding: { select: { id: true, status: true } },
} satisfies Prisma.IaAuditLineInclude;
type LineRow = Prisma.IaAuditLineGetPayload<{ include: typeof lineInclude }>;

export const toLineView = (l: LineRow): LineView => ({
  id: l.id, position: l.position, product: l.product, batchId: l.batchId, pid: l.pid, strain: l.strain, room: l.room,
  serialNo: l.serialNo, unit: l.unit, category: l.category, systemQty: l.systemQty, actualQty: l.actualQty,
  status: l.status, note: l.note, countedByName: l.countedBy ? l.countedBy.name || l.countedBy.email : null,
  countedAt: l.countedAt ? l.countedAt.toISOString() : null, findingId: l.finding?.id ?? null, findingStatus: l.finding?.status ?? null,
  version: String(l.updatedAt.getTime()),
});

export async function recordLine(input: RecordInput, actor: { userId: string }): Promise<RecordResult> {
  const line = await db.iaAuditLine.findUnique({ where: { id: input.lineId }, include: { ...lineInclude, audit: true } });
  if (!line) return { ok: false, error: "That line no longer exists." };
  if (line.audit.status !== "IN_PROGRESS") return { ok: false, error: "This audit is complete — reopen it to change counts." };

  if (!input.force && String(line.updatedAt.getTime()) !== input.version) {
    return {
      ok: false,
      error: `${line.countedBy ? line.countedBy.name || line.countedBy.email : "Someone"} just saved this line.`,
      conflict: { actualQty: line.actualQty, countedByName: line.countedBy ? line.countedBy.name || line.countedBy.email : null },
    };
  }
  if (input.actualQty !== null && (!Number.isFinite(input.actualQty) || input.actualQty < 0)) {
    return { ok: false, error: "The count must be zero or more." };
  }

  const mismatch = isMismatch(line.systemQty, input.actualQty);
  const documenting = input.discrepancy !== undefined;
  if (mismatch && !documenting && !line.findingId) {
    return { ok: false, error: "The count doesn't match — document the discrepancy to save it." };
  }

  // What the finding will look like, if one is being created or updated.
  let findingFields: { categoryId: string; findingTypeId: string; description: string; dueDate: Date | null } | null = null;
  if (documenting) {
    const category = await db.iaFindingCategory.findUnique({ where: { id: input.discrepancy!.categoryId }, include: { findingType: true } });
    if (!category) return { ok: false, error: "Choose what kind of discrepancy this is." };
    findingFields = {
      categoryId: category.id,
      findingTypeId: category.findingTypeId,
      description: describeDiscrepancy(line, input.actualQty, input.discrepancy!.note?.trim() || null),
      dueDate: category.findingType.defaultDueDays != null ? addDays(line.audit.auditDate, category.findingType.defaultDueDays) : null,
    };
    if (!line.findingId && !line.audit.defaultDepartmentId) {
      return { ok: false, error: "This audit has no default department for findings — set one on the audit first." };
    }
  }

  const hasFinding = documenting || line.findingId !== null;
  const status: IaLineStatus = hasFinding ? "DISCREPANCY" : input.actualQty === null ? "PENDING" : "OK";

  const saved = await db.$transaction(async (tx) => {
    let findingId = line.findingId;
    if (findingFields && !findingId) {
      const created = await tx.iaFinding.create({
        data: {
          auditType: line.audit.auditType, auditDate: line.audit.auditDate, auditors: line.audit.auditors,
          facilityId: line.audit.facilityId, departmentId: line.audit.defaultDepartmentId!,
          findingTypeId: findingFields.findingTypeId, categoryId: findingFields.categoryId,
          description: findingFields.description, dueDate: findingFields.dueDate,
          product: line.product, batchId: line.batchId, pid: line.pid, strain: line.strain, quantity: line.systemQty,
          unit: line.unit, room: line.room, serialNo: line.serialNo, auditId: line.auditId, createdById: actor.userId,
          events: { create: { actorId: actor.userId, kind: "CREATED", toStatus: "OPEN", note: `Documented during audit "${line.audit.name}"` } },
        },
        select: { id: true },
      });
      findingId = created.id;
    } else if (findingFields && findingId) {
      // Recounted or re-categorized: keep the one finding, bring it up to date.
      await tx.iaFinding.update({ where: { id: findingId }, data: { categoryId: findingFields.categoryId, description: findingFields.description } });
      await tx.iaFindingEvent.create({ data: { findingId, actorId: actor.userId, kind: "EDITED", note: "Updated from the audit count" } });
    }
    return tx.iaAuditLine.update({
      where: { id: line.id },
      data: {
        actualQty: input.actualQty, status, findingId,
        note: input.discrepancy?.note?.trim() || (documenting ? null : line.note),
        countedById: input.actualQty === null && !documenting ? null : actor.userId,
        countedAt: input.actualQty === null && !documenting ? null : new Date(),
      },
      include: lineInclude,
    });
  });
  return { ok: true, line: toLineView(saved) };
}

// Withdraws a discrepancy that was recorded by mistake (e.g. after a recount
// that now matches). Only while nobody has acted on the finding — once it has
// been notified or worked, it stays and is handled on the finding itself.
export async function clearDiscrepancy(lineId: string, actor: { userId: string }): Promise<RecordResult> {
  const line = await db.iaAuditLine.findUnique({ where: { id: lineId }, include: { ...lineInclude, audit: true } });
  if (!line) return { ok: false, error: "That line no longer exists." };
  if (line.audit.status !== "IN_PROGRESS") return { ok: false, error: "This audit is complete — reopen it to change counts." };
  if (!line.findingId) return { ok: false, error: "There's no discrepancy on this line." };
  if (isMismatch(line.systemQty, line.actualQty)) {
    return { ok: false, error: "The counts still differ — recount first, or keep the discrepancy." };
  }
  const finding = await db.iaFinding.findUnique({ where: { id: line.findingId }, include: { events: true } });
  if (!finding || finding.status !== "OPEN" || finding.events.some((e) => e.kind !== "CREATED" && e.kind !== "EDITED")) {
    return { ok: false, error: "That finding has already been worked on. Handle it on the finding instead." };
  }
  const saved = await db.$transaction(async (tx) => {
    await tx.iaFinding.delete({ where: { id: line.findingId! } }); // the line's link is cleared by the foreign key
    return tx.iaAuditLine.update({
      where: { id: line.id },
      data: { status: line.actualQty === null ? "PENDING" : "OK", note: null, countedById: actor.userId, countedAt: new Date() },
      include: lineInclude,
    });
  });
  return { ok: true, line: toLineView(saved) };
}

// ---------------------------------------------------------------------------
// Audit-level
// ---------------------------------------------------------------------------

export async function auditStats(auditId: string) {
  const g = await db.iaAuditLine.groupBy({ by: ["status"], where: { auditId }, _count: { _all: true } });
  const n = (s: IaLineStatus) => g.find((x) => x.status === s)?._count._all ?? 0;
  const pending = n("PENDING"), ok = n("OK"), discrepancy = n("DISCREPANCY");
  const total = pending + ok + discrepancy;
  return { total, pending, ok, discrepancy, counted: ok + discrepancy, rate: total - pending > 0 ? discrepancy / (total - pending) : 0 };
}

export async function completeAudit(
  auditId: string,
  actor: { userId: string },
  force = false
): Promise<{ ok: true } | { ok: false; error: string; pending?: number }> {
  const audit = await db.iaAudit.findUnique({ where: { id: auditId }, select: { status: true } });
  if (!audit) return { ok: false, error: "That audit no longer exists." };
  if (audit.status === "COMPLETED") return { ok: false, error: "This audit is already complete." };
  const stats = await auditStats(auditId);
  if (stats.pending > 0 && !force) {
    return { ok: false, pending: stats.pending, error: `${stats.pending.toLocaleString("en-US")} line${stats.pending === 1 ? " is" : "s are"} still uncounted.` };
  }
  await db.iaAudit.update({ where: { id: auditId }, data: { status: "COMPLETED", completedAt: new Date(), completedById: actor.userId } });
  return { ok: true };
}

export async function reopenAudit(auditId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await db.iaAudit.updateMany({ where: { id: auditId, status: "COMPLETED" }, data: { status: "IN_PROGRESS", completedAt: null, completedById: null } });
  return r.count === 1 ? { ok: true } : { ok: false, error: "That audit isn't complete." };
}
