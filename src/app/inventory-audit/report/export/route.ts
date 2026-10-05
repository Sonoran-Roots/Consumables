import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { findingScope } from "@/lib/ia/scope";
import { baseWhere, inPeriod, readReportFilters } from "@/lib/ia/report";
import { toDateInput } from "@/lib/ia/dates";
import { isOverdue } from "@/lib/ia/workflow";
import { csvCell as cell } from "@/lib/ia/csv";

const MAX_ROWS = 20000;

export async function GET(request: Request) {
  const me = await getAuditSession();
  if (!me) return new Response("Forbidden", { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const filters = readReportFilters(sp);
  const scope: Prisma.IaFindingWhereInput = await findingScope(me);
  const base = await baseWhere(filters, me.role !== "MANAGER");

  const rows = await db.iaFinding.findMany({
    where: { AND: [scope, base, inPeriod(filters)] },
    orderBy: [{ auditDate: "asc" }, { createdAt: "asc" }],
    take: MAX_ROWS,
    include: {
      facility: true, department: true, secondDepartment: true, findingType: true, category: true,
      assignedTo: { select: { name: true, email: true } },
    },
  });

  const header = [
    "Date Audited", "Facility", "Department", "Second Department", "Finding Type", "Category", "Status", "Due", "Overdue",
    "Finding", "Product", "Batch", "PID", "Strain", "Quantity", "Unit", "Room", "Serial No", "Reference", "Auditors",
    "Assigned To", "Correction", "Monitoring Notes", "Notified", "Resolved", "Resolution Notes", "Verified",
  ];
  const now = new Date();
  const lines = rows.map((f) => [
    toDateInput(f.auditDate), f.facility.name, f.department.name, f.secondDepartment?.name, f.findingType.name, f.category?.name,
    f.status, toDateInput(f.dueDate), isOverdue(f, now) ? "yes" : "", f.description, f.product, f.batchId, f.pid, f.strain, f.quantity,
    f.unit, f.room, f.serialNo, f.reference, f.auditors, f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "", f.correction,
    f.monitoringNotes, toDateInput(f.notifiedAt), toDateInput(f.resolvedAt), f.resolutionNotes, toDateInput(f.verifiedAt),
  ].map(cell).join(","));

  const csv = [header.map(cell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-findings-${toDateInput(filters.from)}-to-${toDateInput(filters.to)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
