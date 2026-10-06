import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { csvCell as cell } from "@/lib/ia/csv";
import { toDateInput } from "@/lib/ia/dates";
import { fieldLabel } from "@/lib/ia/audit-rules";
import { CAN_ENTER_FINDINGS } from "@/lib/ia/workflow";

// Everything audited, line by line: the system's details, what was counted, who
// counted it and when, whether the label was verified, and what was flagged.
export async function GET(_request: Request, ctx: RouteContext<"/inventory-audit/audits/[id]/export">) {
  if (!(await getAuditSession(CAN_ENTER_FINDINGS))) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const audit = await db.iaAudit.findUnique({ where: { id }, include: { facility: true } });
  if (!audit) return new Response("Not found", { status: 404 });

  const lines = await db.iaAuditLine.findMany({
    where: { auditId: id }, orderBy: { position: "asc" },
    include: { countedBy: { select: { name: true, email: true } }, findings: { orderBy: { foundAt: "asc" }, select: { flaggedField: true, foundValue: true, status: true } } },
  });
  const header = [
    "#", "Product", "Package ID (PID)", "Batch", "Strain", "Tag", "Room", "Unit", "Product Category", "Dutchie Status",
    "Harvest Date", "Expiration Date", "Date of Manufacture", "System Qty", "Allocated Qty", "Counted Qty", "Difference",
    "Result", "Label Verified", "Issues Flagged", "Counted By", "Counted At",
  ];
  const rows = lines.map((l) => [
    l.position, l.product, l.pid, l.batchId, l.strain, l.serialNo, l.room, l.unit, l.category, l.itemStatus,
    l.harvestDate, l.expirationDate, l.manufactureDate, l.systemQty, l.allocatedQty, l.actualQty,
    l.systemQty !== null && l.actualQty !== null ? Math.round((l.actualQty - l.systemQty) * 1000) / 1000 : "",
    l.status === "PENDING" ? "Not audited" : l.status === "OK" ? "OK" : "Discrepancy",
    l.labelVerified ? "yes" : "",
    l.findings.map((f) => `${fieldLabel(f.flaggedField)}${f.foundValue ? ` (label: ${f.foundValue})` : ""}`).join("; "),
    l.countedBy ? l.countedBy.name || l.countedBy.email : "", l.countedAt ? l.countedAt.toISOString() : "",
  ].map(cell).join(","));
  const slug = audit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "audit";
  return new Response([header.map(cell).join(","), ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${toDateInput(audit.auditDate)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
