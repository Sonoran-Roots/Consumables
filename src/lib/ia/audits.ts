import { db } from "@/lib/db";
import type { IaAdjustmentStatus, IaAdjustmentTarget, IaLineStatus, Prisma } from "@prisma/client";
import { addDays } from "./dates";
import {
  defaultTarget, describeIssue, fieldDef, isMismatch, type FlagField, type LineView,
} from "./audit-rules";

// ---------------------------------------------------------------------------
// Recording a count and a label check
// ---------------------------------------------------------------------------

export type IssueInput = {
  field: FlagField; // never COUNT: a count that doesn't match is detected from the numbers
  foundValue: string | null; // what the label (or the item) actually shows
  note: string | null;
};

export type RecordInput = {
  lineId: string;
  actualQty: number | null;
  labelVerified: boolean; // the auditor confirms the label matches the system
  countNote: string | null; // note on the count discrepancy, if there is one
  issues: IssueInput[]; // label problems (and anything else) the auditor flagged
  version: string;
  force?: boolean;
};

export type RecordResult =
  | { ok: true; line: LineView }
  | { ok: false; error: string; conflict?: { actualQty: number | null; countedByName: string | null } };

const lineInclude = {
  countedBy: { select: { name: true, email: true } },
  findings: {
    orderBy: { foundAt: "asc" },
    select: { id: true, flaggedField: true, systemValue: true, foundValue: true, monitoringNotes: true, status: true, foundAt: true, needsReview: true },
  },
} satisfies Prisma.IaAuditLineInclude;
export type LineRow = Prisma.IaAuditLineGetPayload<{ include: typeof lineInclude }>;
export const AUDIT_LINE_INCLUDE = lineInclude;

export const toLineView = (l: LineRow): LineView => ({
  id: l.id, position: l.position, product: l.product, batchId: l.batchId, pid: l.pid, strain: l.strain, room: l.room,
  serialNo: l.serialNo, unit: l.unit, category: l.category, itemStatus: l.itemStatus, harvestDate: l.harvestDate,
  expirationDate: l.expirationDate, manufactureDate: l.manufactureDate, systemQty: l.systemQty, allocatedQty: l.allocatedQty,
  actualQty: l.actualQty, status: l.status, labelVerified: l.labelVerified, note: l.note,
  countedByName: l.countedBy ? l.countedBy.name || l.countedBy.email : null,
  countedAt: l.countedAt ? l.countedAt.toISOString() : null,
  issues: l.findings.map((f) => ({
    id: f.id, field: (f.flaggedField ?? "OTHER") as FlagField, systemValue: f.systemValue, foundValue: f.foundValue,
    note: f.monitoringNotes, status: f.status, foundAt: f.foundAt.toISOString(), reviewed: !f.needsReview,
  })),
  version: String(l.updatedAt.getTime()),
});

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export async function recordLine(input: RecordInput, actor: { userId: string }): Promise<RecordResult> {
  const line = await db.iaAuditLine.findUnique({ where: { id: input.lineId }, include: { ...lineInclude, audit: true } });
  if (!line) return { ok: false, error: "That line no longer exists." };
  if (line.audit.status !== "IN_PROGRESS") return { ok: false, error: "This audit is complete — reopen it to change counts." };

  if (!input.force && String(line.updatedAt.getTime()) !== input.version) {
    const who = line.countedBy ? line.countedBy.name || line.countedBy.email : null;
    return { ok: false, error: `${who ?? "Someone"} just saved this line.`, conflict: { actualQty: line.actualQty, countedByName: who } };
  }

  const actual = input.actualQty;
  if (actual === null || !Number.isFinite(actual) || actual < 0) return { ok: false, error: "Enter the count (zero or more)." };

  // The label has to have been looked at: confirmed, or something on it flagged.
  const issues = new Map<FlagField, IssueInput>();
  for (const i of input.issues) if (i.field !== "COUNT" && fieldDef(i.field)) issues.set(i.field, i);
  if (!input.labelVerified && issues.size === 0) {
    return { ok: false, error: "Confirm the label matches the system, or flag what's wrong with it." };
  }

  // Everything that should have a finding after this save.
  const desired = new Map<FlagField, { foundValue: string | null; note: string | null }>();
  if (isMismatch(line.systemQty, actual)) desired.set("COUNT", { foundValue: String(actual), note: clean(input.countNote) });
  for (const [field, i] of issues) desired.set(field, { foundValue: clean(i.foundValue), note: clean(i.note) });

  const existingByField = new Map(line.findings.map((f) => [f.flaggedField as FlagField, f]));
  const creating = [...desired.keys()].filter((f) => !existingByField.has(f));
  if (creating.length > 0 && !line.audit.defaultDepartmentId) {
    return { ok: false, error: "This audit has no default department for findings — an audit manager needs to set one." };
  }

  const saved = await db.$transaction(async (tx) => {
    const [categories, types] = await Promise.all([
      tx.iaFindingCategory.findMany({ include: { findingType: true } }),
      tx.iaFindingType.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    const fallbackType = types.find((t) => t.name === "Internal Process") ?? types[0];

    for (const [field, d] of desired) {
      const def = fieldDef(field)!;
      const systemValue = field === "COUNT" ? (line.systemQty !== null ? String(line.systemQty) : null) : def.read?.(line) ?? null;
      const description = describeIssue(line, field, d.foundValue, actual, d.note);
      const existing = existingByField.get(field);
      if (existing) {
        const changed = existing.foundValue !== d.foundValue || (existing.monitoringNotes ?? null) !== d.note;
        if (changed) {
          await tx.iaFinding.update({ where: { id: existing.id }, data: { description, foundValue: d.foundValue, monitoringNotes: d.note } });
          await tx.iaFindingEvent.create({ data: { findingId: existing.id, actorId: actor.userId, kind: "EDITED", note: "Updated during the audit" } });
        }
        continue;
      }
      const category = def.category ? categoryByName.get(def.category) : undefined;
      const type = category?.findingType ?? fallbackType;
      await tx.iaFinding.create({
        data: {
          auditType: line.audit.auditType, auditDate: line.audit.auditDate, auditors: line.audit.auditors,
          facilityId: line.audit.facilityId, departmentId: line.audit.defaultDepartmentId!,
          findingTypeId: type.id, categoryId: category?.id ?? null, description,
          dueDate: type.defaultDueDays != null ? addDays(line.audit.auditDate, type.defaultDueDays) : null,
          product: line.product, batchId: line.batchId, pid: line.pid, strain: line.strain, quantity: line.systemQty,
          unit: line.unit, room: line.room, serialNo: line.serialNo,
          auditId: line.auditId, auditLineId: line.id,
          flaggedField: field, systemValue, foundValue: d.foundValue, monitoringNotes: d.note,
          foundAt: new Date(), needsReview: true, adjustmentStatus: "PENDING", adjustmentTarget: defaultTarget(field),
          createdById: actor.userId,
          events: { create: { actorId: actor.userId, kind: "CREATED", toStatus: "OPEN", note: `Documented during audit "${line.audit.name}"` } },
        },
      });
    }

    // Problems the auditor un-flagged: remove them, unless somebody has already acted on the finding.
    for (const [field, f] of existingByField) {
      if (desired.has(field)) continue;
      const events = await tx.iaFindingEvent.findMany({ where: { findingId: f.id }, select: { kind: true } });
      if (f.status === "OPEN" && f.needsReview && events.every((e) => e.kind === "CREATED" || e.kind === "EDITED")) {
        await tx.iaFinding.delete({ where: { id: f.id } });
      }
    }

    const remaining = await tx.iaFinding.count({ where: { auditLineId: line.id } });
    const status: IaLineStatus = remaining > 0 ? "DISCREPANCY" : "OK";
    return tx.iaAuditLine.update({
      where: { id: line.id },
      data: { actualQty: actual, labelVerified: true, status, note: clean(input.countNote), countedById: actor.userId, countedAt: new Date() },
      include: lineInclude,
    });
  });
  return { ok: true, line: toLineView(saved) };
}

// ---------------------------------------------------------------------------
// Audit-level
// ---------------------------------------------------------------------------

export async function auditStats(auditId: string) {
  const [g, toReview, pendingAdjustments] = await Promise.all([
    db.iaAuditLine.groupBy({ by: ["status"], where: { auditId }, _count: { _all: true } }),
    db.iaFinding.count({ where: { auditId, needsReview: true } }),
    db.iaFinding.count({ where: { auditId, adjustmentStatus: "PENDING" } }),
  ]);
  const n = (s: IaLineStatus) => g.find((x) => x.status === s)?._count._all ?? 0;
  const pending = n("PENDING"), ok = n("OK"), discrepancy = n("DISCREPANCY");
  const total = pending + ok + discrepancy;
  return { total, pending, ok, discrepancy, counted: ok + discrepancy, rate: total - pending > 0 ? discrepancy / (total - pending) : 0, toReview, pendingAdjustments };
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

// ---------------------------------------------------------------------------
// Review: an audit manager fills in what the auditors didn't have time to
// ---------------------------------------------------------------------------

export type ReviewPatch = {
  categoryId?: string | null;
  departmentId?: string;
  assignedToId?: string | null;
  dueDate?: Date | null;
  adjustmentTarget?: IaAdjustmentTarget | null;
  adjustmentStatus?: "PENDING" | "NOT_NEEDED";
  markReviewed?: boolean;
};

export async function reviewFinding(findingId: string, patch: ReviewPatch, actor: { userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const f = await db.iaFinding.findUnique({ where: { id: findingId }, select: { id: true, assignedToId: true, adjustmentStatus: true } });
  if (!f) return { ok: false, error: "That finding no longer exists." };

  const data: Prisma.IaFindingUncheckedUpdateInput = {};
  const notes: string[] = [];
  if (patch.categoryId !== undefined) {
    if (patch.categoryId) {
      const cat = await db.iaFindingCategory.findUnique({ where: { id: patch.categoryId } });
      if (!cat) return { ok: false, error: "That category doesn't exist." };
      data.categoryId = cat.id;
      data.findingTypeId = cat.findingTypeId; // a category implies its type (impact level)
      notes.push(`category: ${cat.name}`);
    } else data.categoryId = null;
  }
  if (patch.departmentId) {
    const d = await db.iaDepartment.findUnique({ where: { id: patch.departmentId } });
    if (!d) return { ok: false, error: "That department doesn't exist." };
    data.departmentId = d.id;
    notes.push(`department: ${d.name}`);
  }
  if (patch.assignedToId !== undefined) {
    if (patch.assignedToId) {
      const u = await db.user.findUnique({ where: { id: patch.assignedToId }, select: { name: true, email: true, auditRole: true } });
      if (!u || !u.auditRole) return { ok: false, error: "That person doesn't have Inventory Audit access." };
      notes.push(`assigned to ${u.name || u.email}`);
    } else notes.push("unassigned");
    data.assignedToId = patch.assignedToId;
  }
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;
  if (patch.adjustmentTarget !== undefined) data.adjustmentTarget = patch.adjustmentTarget;
  if (patch.adjustmentStatus && f.adjustmentStatus !== "APPLIED") data.adjustmentStatus = patch.adjustmentStatus;
  if (patch.markReviewed) {
    data.needsReview = false;
    data.reviewedAt = new Date();
    data.reviewedById = actor.userId;
  }
  await db.$transaction([
    db.iaFinding.update({ where: { id: findingId }, data }),
    db.iaFindingEvent.create({
      data: { findingId, actorId: actor.userId, kind: patch.assignedToId !== undefined ? "ASSIGNED" : "EDITED", note: notes.length ? `Reviewed — ${notes.join("; ")}` : "Reviewed" },
    }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

export async function setAdjustment(
  findingId: string,
  status: IaAdjustmentStatus,
  actor: { userId: string },
  note?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const f = await db.iaFinding.findUnique({ where: { id: findingId }, select: { id: true } });
  if (!f) return { ok: false, error: "That finding no longer exists." };
  await db.$transaction([
    db.iaFinding.update({
      where: { id: findingId },
      data: {
        adjustmentStatus: status,
        adjustedAt: status === "APPLIED" ? new Date() : null,
        adjustedById: status === "APPLIED" ? actor.userId : null,
        ...(note !== undefined ? { adjustmentNote: clean(note) } : {}),
      },
    }),
    db.iaFindingEvent.create({
      data: { findingId, actorId: actor.userId, kind: "EDITED", note: status === "APPLIED" ? "Adjustment applied" : status === "NOT_NEEDED" ? "Marked: no adjustment needed" : "Adjustment marked as pending" },
    }),
  ]);
  return { ok: true };
}
