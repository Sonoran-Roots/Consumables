import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { IaAuditType, IaFindingStatus, Prisma } from "@prisma/client";
import { buildLookup } from "@/lib/ia/lookup";
import { addDays, parseFlexibleDate } from "@/lib/ia/dates";
import { hasColumn, parseCsv, pick, truthy } from "@/lib/ia/csv";

export type UploadResult = {
  checkOnly: boolean;
  created: number;
  skippedNotFindings: number;
  skippedDuplicates: number;
  errors: string[];
  notes: string[];
} | null;

const fail = (message: string, checkOnly: boolean): NonNullable<UploadResult> => ({
  checkOnly, created: 0, skippedNotFindings: 0, skippedDuplicates: 0, errors: [message], notes: [],
});

const num = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
const day = (d: Date) => d.toISOString().slice(0, 10);

type Fingerprintable = {
  auditDate: Date; facilityId: string; product: string | null; batchId: string | null; pid: string | null;
  description: string; quantity: number | null; room: string | null; serialNo: string | null; reference: string | null;
};
const fingerprint = (f: Fingerprintable) =>
  [day(f.auditDate), f.facilityId, f.product ?? "", f.batchId ?? "", f.pid ?? "", f.description, f.quantity ?? "", f.room ?? "", f.serialNo ?? "", f.reference ?? ""]
    .join("\u0001")
    .toLowerCase();

// Reads a CSV exported from a tracker tab. The columns are the tracker's own
// (Date, Auditor Initials, Product, Batch, PID, Discrepancy Found, Finding
// Type, Intial Discrepancy Finding, Dept. 1, Dept. 2, Facility, ...). If the
// file has a "Discrepancy Found" column only the rows marked TRUE become
// findings; clean audited lines are skipped. Re-uploading the same file is
// safe: a finding already on file (same date, facility, product, batch, PID
// and description) is skipped, not duplicated.
export async function runFindingsImport(
  text: string,
  opts: {
    auditType: IaAuditType;
    checkOnly: boolean;
    actorId: string;
    // What a TRUE "Resolution Confirmed" means when the file has no separate
    // "Verified By Inventory" column: the inventory team's own confirmation
    // (VERIFIED, the default) or only the department's fix (RESOLVED).
    confirmedMeans?: "VERIFIED" | "RESOLVED";
  }
): Promise<NonNullable<UploadResult>> {
  const { rows, error } = parseCsv(text);
  if (error) return fail(error, opts.checkOnly);

  const [facilities, departments, types, categories] = await Promise.all([
    db.iaFacility.findMany(),
    db.iaDepartment.findMany(),
    db.iaFindingType.findMany(),
    db.iaFindingCategory.findMany(),
  ]);
  const categoryOf = buildLookup(categories);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const hasVerifiedColumn = hasColumn(rows[0], [], ["verifiedbyinventory"]);
  const confirmedMeans = opts.confirmedMeans ?? "VERIFIED";
  const facilityOf = buildLookup(facilities);
  const departmentOf = buildLookup(departments);
  const typeOf = buildLookup(types);

  const filterColumn = hasColumn(rows[0], ["discrepancyfound"]);
  const errors: string[] = [];
  let skippedNotFindings = 0;
  let skippedDuplicates = 0;

  type Draft = { data: Prisma.IaFindingUncheckedCreateInput; key: string };
  const drafts: Draft[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    if (filterColumn && !truthy(pick(row, ["discrepancyfound"]))) {
      skippedNotFindings++;
      return;
    }

    const dateRaw = pick(row, ["date", "dateaudited", "auditdate"]);
    const findingText = pick(row, ["description", "finding"], ["initialdiscrepancyfinding", "intialdiscrepancyfinding"]);
    // The trackers keep placeholder rows ("DO NOT DELETE THIS ROW", month
    // headers) that can have the flag set; with no date and no finding text
    // there's nothing to import, so skip them quietly.
    if (!dateRaw && !findingText) {
      skippedNotFindings++;
      return;
    }

    const problems: string[] = [];
    const auditDate = parseFlexibleDate(dateRaw);
    if (!auditDate) problems.push(dateRaw ? `date "${dateRaw}" isn't a date I understand (use YYYY-MM-DD or M/D/YYYY)` : "date is required");

    const facilityRaw = pick(row, ["facility", "location"]);
    const facility = facilityRaw ? facilityOf(facilityRaw) : undefined;
    if (!facility) problems.push(facilityRaw ? `facility "${facilityRaw}" isn't in the facility list` : "facility is required");

    // "Type" alone is NOT the finding type: on the plant-audit tabs it's the
    // kind of plant (Plant / Clones), which goes in the unit column below.
    const typeRaw = pick(row, ["findingtype", "impactlevel"]);
    // Only a column headed "Finding Category": the product tabs have a plain "Category"
    // column that means the PRODUCT's category (Vape Disposable Distillate, ...).
    const categoryRaw = pick(row, ["findingcategory", "auditfindingtype"]);
    const category = categoryRaw ? categoryOf(categoryRaw) : undefined;
    if (categoryRaw && !category) problems.push(`finding category "${categoryRaw}" isn't in the category list`);
    // A category implies its type, so the type column can be left out when one is given.
    const type = typeRaw ? typeOf(typeRaw) : category ? typeById.get(category.findingTypeId) : undefined;
    if (!type) {
      problems.push(typeRaw ? `finding type "${typeRaw}" isn't in the finding-type list` : "finding type is required");
    }

    const deptRaw = pick(row, ["dept1", "department", "dept"]);
    const dept = deptRaw ? departmentOf(deptRaw) : undefined;
    if (!dept) problems.push(deptRaw ? `department "${deptRaw}" isn't in the department list` : "department (Dept. 1) is required");

    const dept2Raw = pick(row, ["dept2", "seconddepartment"]);
    const dept2 = dept2Raw ? departmentOf(dept2Raw) : undefined;
    if (dept2Raw && !dept2) problems.push(`second department "${dept2Raw}" isn't in the department list`);

    const description = findingText;
    if (!description) problems.push("the discrepancy finding (description) is required");

    const disposalRaw = pick(row, [], ["dateofphysicaldisposal"]);
    const disposalDate = disposalRaw ? parseFlexibleDate(disposalRaw) : null;
    if (disposalRaw && !disposalDate) problems.push(`disposal date "${disposalRaw}" isn't a date I understand`);

    const resolutionRaw = pick(row, ["resolutiondate"]);
    const resolutionDate = resolutionRaw ? parseFlexibleDate(resolutionRaw) : null;
    if (resolutionRaw && !resolutionDate) problems.push(`resolution date "${resolutionRaw}" isn't a date I understand`);

    if (problems.length > 0 || !auditDate || !facility || !type || !dept) {
      errors.push(`Row ${rowNum}: ${problems.join("; ")}.`);
      return;
    }

    const confirmed = truthy(pick(row, [], ["resolutionconfirmed"]));
    const verified = hasVerifiedColumn
      ? truthy(pick(row, [], ["verifiedbyinventory"]))
      : confirmed && confirmedMeans === "VERIFIED";
    const resolved = verified || confirmed;
    const notified = resolved || truthy(pick(row, [], ["monitoringactionteamsnotified"]));
    const status: IaFindingStatus = verified ? "VERIFIED" : resolved ? "RESOLVED" : notified ? "NOTIFIED" : "OPEN";

    const product = pick(row, ["product", "productname"]) || null;
    const batchId = pick(row, ["batch", "batchid", "harvestbatch"], ["batchidonwrittenlog"]) || null;
    const pid = pick(row, ["pid"]) || null;
    const rectifiedBy = pick(row, [], ["rectifiedby"]);
    const extraNotes = [pick(row, [], ["additionalmonitoringactionnotes"]) || pick(row, ["monitoringnotes"]), pick(row, ["notes"])]
      .filter(Boolean)
      .join(" | ");

    const quantity = num(pick(row, ["quantity", "qty", "count"], ["qtyinc"]));
    const room = pick(row, ["room"]) || null;
    const serialNo = pick(row, ["serialno", "serial", "serialnumber"]) || null;
    const reference = pick(row, [], ["reference"]) || null;
    // Same date/facility/product/batch/PID/text can still be different bins or
    // pallets, so count, room, serial and reference are part of "the same finding".
    const key = fingerprint({ auditDate, facilityId: facility.id, product, batchId, pid, description, quantity, room, serialNo, reference });
    if (seen.has(key)) {
      skippedDuplicates++;
      return;
    }
    seen.add(key);

    drafts.push({
      key,
      data: {
        id: randomUUID(),
        auditType: opts.auditType,
        auditDate,
        auditors: pick(row, ["auditorinitials", "auditorintials", "initials", "intials", "auditors"]) || null,
        facilityId: facility.id,
        findingTypeId: type.id,
        categoryId: category?.id ?? null,
        departmentId: dept.id,
        secondDepartmentId: dept2?.id ?? null,
        description,
        product,
        batchId,
        pid,
        strain: pick(row, ["strain"], ["strainonwrittenlog"]) || null,
        quantity,
        // Plant tabs: "Type" is Plant / Clones / Seedlings — what the count is a count of.
        unit: pick(row, ["unit", "type"]) || null,
        room,
        serialNo,
        reference,
        weightGrams: num(pick(row, [], ["weightdisposed"])),
        disposalDate,
        correction: pick(row, ["correction"]) || null,
        monitoringNotes: extraNotes || null,
        status,
        notifiedAt: notified ? auditDate : null,
        resolvedAt: resolved ? (resolutionDate ?? auditDate) : null,
        verifiedAt: verified ? (resolutionDate ?? auditDate) : null,
        resolutionNotes: resolved && rectifiedBy ? `Rectified by ${rectifiedBy} (from tracker)` : null,
        // Open work gets the type's default due date; finished work doesn't need one.
        dueDate: status === "OPEN" || status === "NOTIFIED" ? (type.defaultDueDays != null ? addDays(auditDate, type.defaultDueDays) : null) : null,
        createdById: opts.actorId,
      },
    });
  });

  // Already-on-file check, so re-uploading a file doesn't double up.
  let fresh = drafts;
  if (drafts.length > 0) {
    const dates = drafts.map((d) => d.data.auditDate as Date);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const existing = await db.iaFinding.findMany({
      where: { auditDate: { gte: min, lte: max } },
      select: { auditDate: true, facilityId: true, product: true, batchId: true, pid: true, description: true, quantity: true, room: true, serialNo: true, reference: true },
    });
    const onFile = new Set(existing.map((e) => fingerprint(e)));
    fresh = drafts.filter((d) => !onFile.has(d.key));
    skippedDuplicates += drafts.length - fresh.length;
  }

  const byStatus: Record<string, number> = {};
  for (const d of fresh) byStatus[d.data.status as string] = (byStatus[d.data.status as string] ?? 0) + 1;
  const notes: string[] = [];
  if (fresh.length > 0) {
    notes.push(
      `Statuses: ${Object.entries(byStatus).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(", ")}.`
    );
  }
  if (skippedNotFindings > 0) notes.push(`${skippedNotFindings} audited line${skippedNotFindings === 1 ? "" : "s"} skipped because Discrepancy Found wasn't TRUE.`);
  if (skippedDuplicates > 0) notes.push(`${skippedDuplicates} finding${skippedDuplicates === 1 ? "" : "s"} skipped because they're already on file (or repeated in the file).`);

  const result: NonNullable<UploadResult> = {
    checkOnly: opts.checkOnly, created: fresh.length, skippedNotFindings, skippedDuplicates, errors, notes,
  };
  if (opts.checkOnly || fresh.length === 0) return result;

  try {
    await db.$transaction([
      db.iaFinding.createMany({ data: fresh.map((d) => d.data) }),
      db.iaFindingEvent.createMany({
        data: fresh.map((d) => ({
          findingId: d.data.id as string,
          actorId: opts.actorId,
          kind: "CREATED",
          toStatus: d.data.status as IaFindingStatus,
          note: "Uploaded from tracker",
        })),
      }),
    ]);
  } catch (e) {
    return fail(`Nothing was saved — the database rejected the batch: ${(e as Error).message}`, false);
  }
  return result;
}
