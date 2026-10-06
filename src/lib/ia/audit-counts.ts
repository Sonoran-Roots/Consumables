import { db } from "@/lib/db";
import { describeIssue, isMismatch, type LineLike } from "./audit-rules";
import { parseCompletedTable } from "./audit-import";
import { buildLookup } from "./lookup";
import { addDays } from "./dates";

export type CountsOptions = {
  // Rows Dutchie didn't touch (no "Counted On" time, count equals expected):
  // true = count them as audited OK; false = leave them pending.
  countUnchanged: boolean;
  // The completed table is the audit after it was closed in Dutchie, so its
  // quantity changes have already been made there.
  alreadyAdjusted: boolean;
  checkOnly: boolean;
};

export type CountsResult = {
  checkOnly: boolean;
  matched: number;
  countedOk: number;
  discrepancies: number;
  leftPending: number;
  skippedAlreadyCounted: number;
  expectedDiffers: number;
  errors: string[];
  notes: string[];
};

const COUNT_CATEGORY = "Variances between systematic and physical counts";
const fail = (checkOnly: boolean, message: string): CountsResult => ({
  checkOnly, matched: 0, countedOk: 0, discrepancies: 0, leftPending: 0, skippedAlreadyCounted: 0, expectedDiffers: 0, errors: [message], notes: [],
});

export async function applyCompletedCounts(auditId: string, text: string, opts: CountsOptions, actor: { userId: string }): Promise<CountsResult> {
  const audit = await db.iaAudit.findUnique({ where: { id: auditId } });
  if (!audit) return fail(opts.checkOnly, "That audit no longer exists.");
  if (audit.status !== "IN_PROGRESS") return fail(opts.checkOnly, "This audit is complete — reopen it to load counts.");

  const parsed = parseCompletedTable(text);
  if (parsed.error) return fail(opts.checkOnly, parsed.error);

  const [lines, reasons, category, types] = await Promise.all([
    db.iaAuditLine.findMany({
      where: { auditId },
      include: { findings: { where: { flaggedField: "COUNT" }, include: { events: { select: { kind: true } } } } },
    }),
    db.iaAdjustmentReason.findMany(),
    db.iaFindingCategory.findFirst({ where: { name: COUNT_CATEGORY }, include: { findingType: true } }),
    db.iaFindingType.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const type = category?.findingType ?? types.find((t) => t.name === "Internal Process") ?? types[0];
  const reasonOf = buildLookup(reasons);

  const byDutchieId = new Map(lines.filter((l) => l.dutchieId).map((l) => [l.dutchieId!, l]));
  const byPid = new Map<string, typeof lines>();
  for (const l of lines) if (l.pid) byPid.set(l.pid.toLowerCase(), [...(byPid.get(l.pid.toLowerCase()) ?? []), l]);

  const errors: string[] = [];
  const unknownReasons = new Set<string>();
  const result: CountsResult = { checkOnly: opts.checkOnly, matched: 0, countedOk: 0, discrepancies: 0, leftPending: 0, skippedAlreadyCounted: 0, expectedDiffers: 0, errors, notes: [] };
  const now = new Date();
  const bulkOkIds: string[] = [];
  type Work = { line: (typeof lines)[number]; row: (typeof parsed.rows)[number]; reasonId: string | null; mismatch: boolean };
  const individual: Work[] = [];
  const seen = new Set<string>();

  for (const row of parsed.rows) {
    let line = row.dutchieId ? byDutchieId.get(row.dutchieId) : undefined;
    if (!line && row.pid) {
      const matches = byPid.get(row.pid.toLowerCase()) ?? [];
      if (matches.length > 1) { errors.push(`Row ${row.rowNumber}: package "${row.pid}" appears more than once in this audit — it can't be matched without the Dutchie Id.`); continue; }
      line = matches[0];
    }
    if (!line) { errors.push(`Row ${row.rowNumber}: package "${row.pid ?? row.dutchieId}" isn't in this audit.`); continue; }
    if (seen.has(line.id)) { errors.push(`Row ${row.rowNumber}: package "${row.pid ?? row.dutchieId}" is listed twice in the file.`); continue; }
    seen.add(line.id);
    result.matched++;

    if (row.countedQty === null) { result.leftPending++; continue; }
    const system = line.systemQty ?? row.expectedQty;
    if (row.expectedQty !== null && line.systemQty !== null && isMismatch(row.expectedQty, line.systemQty)) result.expectedDiffers++;
    const mismatch = isMismatch(system, row.countedQty);

    let reasonId: string | null = null;
    if (row.reason) {
      const r = reasonOf(row.reason);
      if (r) reasonId = r.id;
      else unknownReasons.add(row.reason);
    }

    const hasCountFinding = line.findings.length > 0;
    if (!mismatch && !hasCountFinding && line.systemQty !== null) {
      // Nothing changed in Dutchie for this package.
      if (!row.countedOn && !opts.countUnchanged) { result.leftPending++; continue; }
      if (line.status !== "PENDING") { result.skippedAlreadyCounted++; continue; } // keep what was counted in the app
      result.countedOk++;
      bulkOkIds.push(line.id);
      continue;
    }
    if (mismatch && !audit.defaultDepartmentId && !hasCountFinding) {
      errors.push(`Row ${row.rowNumber}: this audit has no default department for findings — set one first.`);
      continue;
    }
    individual.push({ line, row, reasonId, mismatch });
    if (mismatch) result.discrepancies++;
    else result.countedOk++;
  }

  for (const r of unknownReasons) errors.push(`Adjustment reason "${r}" isn't in the list — add it in Settings, then upload the file again (rows already loaded are kept).`);
  if (result.expectedDiffers > 0) {
    result.notes.push(`${result.expectedDiffers} package${result.expectedDiffers === 1 ? "'s" : "s'"} Expected Qty differs from the initial upload — Dutchie's inventory changed in between. The initial figure is kept as "system".`);
  }
  if (result.skippedAlreadyCounted > 0) result.notes.push(`${result.skippedAlreadyCounted} unchanged package${result.skippedAlreadyCounted === 1 ? " was" : "s were"} already counted in the app, so they were left as they are.`);
  if (result.leftPending > 0) result.notes.push(`${result.leftPending} package${result.leftPending === 1 ? " was" : "s were"} left pending (no count in the file${opts.countUnchanged ? "" : ", or unchanged and not counted as audited"}).`);
  if (opts.checkOnly) return result;

  // Unchanged packages in bulk.
  for (let i = 0; i < bulkOkIds.length; i += 1000) {
    const ids = bulkOkIds.slice(i, i + 1000);
    await db.$executeRaw`UPDATE "IaAuditLine" SET "actualQty" = "systemQty", "status" = 'OK', "countedById" = ${actor.userId}, "countedAt" = ${now}, "updatedAt" = ${now} WHERE "id" = ANY(${ids}::text[]) AND "status" = 'PENDING' AND "systemQty" IS NOT NULL`;
  }

  // Everything that changed (or already has a finding) one at a time.
  for (const { line, row, reasonId, mismatch } of individual) {
    const countedAt = row.countedOn ?? now;
    const counted = row.countedQty!;
    const note = row.note ?? null;
    await db.$transaction(async (tx) => {
      const existing = line.findings[0];
      let hasFinding = false;
      if (mismatch) {
        hasFinding = true;
        const like: LineLike = { ...line };
        const description = describeIssue(like, "COUNT", String(counted), counted, note);
        const adjusted = opts.alreadyAdjusted;
        const adjustment = {
          adjustmentStatus: adjusted ? ("APPLIED" as const) : ("PENDING" as const),
          adjustedAt: adjusted ? countedAt : null,
          adjustedById: adjusted ? actor.userId : null,
          adjustmentReasonId: reasonId,
        };
        if (existing) {
          await tx.iaFinding.update({ where: { id: existing.id }, data: { description, foundValue: String(counted), monitoringNotes: note, ...adjustment } });
          await tx.iaFindingEvent.create({ data: { findingId: existing.id, actorId: actor.userId, kind: "EDITED", note: "Updated from the completed Dutchie audit table" } });
        } else {
          await tx.iaFinding.create({
            data: {
              auditType: audit.auditType, auditDate: audit.auditDate, auditors: audit.auditors, facilityId: audit.facilityId, departmentId: audit.defaultDepartmentId!,
              findingTypeId: type.id, categoryId: category?.id ?? null, description,
              dueDate: type.defaultDueDays != null ? addDays(audit.auditDate, type.defaultDueDays) : null,
              product: line.product, batchId: line.batchId, pid: line.pid, strain: line.strain, quantity: line.systemQty, unit: line.unit, room: line.room, serialNo: line.serialNo,
              auditId, auditLineId: line.id, flaggedField: "COUNT", systemValue: line.systemQty !== null ? String(line.systemQty) : null, foundValue: String(counted),
              monitoringNotes: note, foundAt: countedAt, needsReview: true, adjustmentTarget: "SYSTEM", ...adjustment, createdById: actor.userId,
              events: { create: { actorId: actor.userId, kind: "CREATED", toStatus: "OPEN", note: `Counted in the Dutchie audit table for "${audit.name}"` } },
            },
          });
        }
      } else if (existing) {
        // The completed table says the count matches: drop an untouched finding from an earlier in-app count.
        const untouched = existing.status === "OPEN" && existing.needsReview && existing.events.every((e) => e.kind === "CREATED" || e.kind === "EDITED");
        if (untouched) await tx.iaFinding.delete({ where: { id: existing.id } });
        else hasFinding = true;
      }
      const otherFindings = await tx.iaFinding.count({ where: { auditLineId: line.id } });
      await tx.iaAuditLine.update({
        where: { id: line.id },
        data: { actualQty: counted, status: hasFinding || otherFindings > 0 ? "DISCREPANCY" : "OK", note, countedById: actor.userId, countedAt },
      });
    });
  }
  return result;
}
