import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { csvCell as cell } from "@/lib/ia/csv";
import { toDateInput } from "@/lib/ia/dates";
import { defaultTarget, describeAdjustment, fieldLabel, lineLabel } from "@/lib/ia/audit-rules";
import { CAN_RUN_AUDITS } from "@/lib/ia/workflow";

const TARGET = { SYSTEM: "Dutchie", LABEL: "Label", BOTH: "Dutchie + label" } as const;

// The adjustments report as a spreadsheet: one row per correction to make.
export async function GET(request: Request, ctx: RouteContext<"/inventory-audit/adjustments/[id]/export">) {
  if (!(await getAuditSession(CAN_RUN_AUDITS))) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const audit = await db.iaAudit.findUnique({ where: { id }, include: { facility: true } });
  if (!audit) return new Response("Not found", { status: 404 });

  const all = new URL(request.url).searchParams.get("show") === "all";
  const findings = await db.iaFinding.findMany({
    where: { auditId: id, ...(all ? { adjustmentStatus: { not: "NOT_NEEDED" } } : { adjustmentStatus: "PENDING" }) },
    orderBy: [{ auditLine: { position: "asc" } }, { foundAt: "asc" }],
    include: {
      auditLine: { select: { position: true, product: true, strain: true, batchId: true, pid: true, serialNo: true, room: true } },
      assignedTo: { select: { name: true, email: true } },
      adjustmentReason: { select: { name: true } },
    },
  });
  const header = ["Item", "Package ID (PID)", "Batch", "Room", "Field", "System value", "Found value", "Adjustment needed", "Adjustment reason", "Fix in", "Status", "Done on", "Owner", "Found at", "Notes"];
  const rows = findings.map((f) => {
    const target = f.adjustmentTarget ?? defaultTarget(f.flaggedField);
    return [
      f.auditLine ? lineLabel(f.auditLine) : "", f.auditLine?.pid, f.auditLine?.batchId, f.auditLine?.room, fieldLabel(f.flaggedField),
      f.systemValue, f.foundValue,
      describeAdjustment({ flaggedField: f.flaggedField, systemValue: f.systemValue, foundValue: f.foundValue, unit: f.unit, target }),
      f.adjustmentReason?.name ?? "", TARGET[target], f.adjustmentStatus === "APPLIED" ? "Done" : "To do", toDateInput(f.adjustedAt),
      f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "", f.foundAt.toISOString(), f.monitoringNotes,
    ].map(cell).join(",");
  });
  const slug = audit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "audit";
  return new Response([header.map(cell).join(","), ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adjustments-${slug}-${toDateInput(audit.auditDate)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
