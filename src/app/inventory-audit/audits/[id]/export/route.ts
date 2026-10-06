import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { csvCell as cell } from "@/lib/ia/csv";
import { toDateInput } from "@/lib/ia/dates";
import { CAN_ENTER_FINDINGS } from "@/lib/ia/workflow";

// The audit's lines with their counts — the tracker-style record of what was
// audited, who counted it, and where a discrepancy was documented.
export async function GET(_request: Request, ctx: RouteContext<"/inventory-audit/audits/[id]/export">) {
  if (!(await getAuditSession(CAN_ENTER_FINDINGS))) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const audit = await db.iaAudit.findUnique({ where: { id }, include: { facility: true } });
  if (!audit) return new Response("Not found", { status: 404 });

  const lines = await db.iaAuditLine.findMany({
    where: { auditId: id }, orderBy: { position: "asc" },
    include: { countedBy: { select: { name: true, email: true } }, finding: { select: { status: true, description: true } } },
  });
  const header = ["#", "Product", "Batch", "PID", "Strain", "Room", "Serial No", "Unit", "Product Category", "System Qty", "Counted Qty", "Difference", "Status", "Counted By", "Counted At", "Note", "Finding Status", "Finding"];
  const rows = lines.map((l) => [
    l.position, l.product, l.batchId, l.pid, l.strain, l.room, l.serialNo, l.unit, l.category, l.systemQty, l.actualQty,
    l.systemQty !== null && l.actualQty !== null ? Math.round((l.actualQty - l.systemQty) * 1000) / 1000 : "",
    l.status, l.countedBy ? l.countedBy.name || l.countedBy.email : "", l.countedAt ? l.countedAt.toISOString() : "", l.note,
    l.finding?.status ?? "", l.finding?.description ?? "",
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
