import Link from "next/link";
import { notFound } from "next/navigation";
import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { auditStats } from "@/lib/ia/audits";
import { describeAdjustment, defaultTarget, fieldLabel, lineLabel } from "@/lib/ia/audit-rules";
import { formatDate } from "@/lib/ia/dates";
import { CAN_RUN_AUDITS } from "@/lib/ia/workflow";
import { setAdjustmentStatus } from "../../review/actions";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();
const TARGET = { SYSTEM: "Dutchie", LABEL: "Label", BOTH: "Dutchie + label" } as const;

export default async function AdjustmentsPage({ params, searchParams }: PageProps<"/inventory-audit/adjustments/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) notFound();

  const audit = await db.iaAudit.findUnique({ where: { id }, include: { facility: true } });
  if (!audit) notFound();

  const stats = await auditStats(id);
  const show = one(sp.show) === "all" ? "all" : "open";
  const findings = await db.iaFinding.findMany({
    where: { auditId: id, ...(show === "open" ? { adjustmentStatus: "PENDING" } : { adjustmentStatus: { not: "NOT_NEEDED" } }) },
    orderBy: [{ auditLine: { position: "asc" } }, { foundAt: "asc" }],
    include: {
      auditLine: { select: { position: true, product: true, strain: true, batchId: true, pid: true, serialNo: true, room: true } },
      assignedTo: { select: { name: true, email: true } },
    },
  });

  const counts = findings.filter((f) => f.flaggedField === "COUNT");
  const netQty = counts.reduce((t, f) => {
    const d = Number(f.foundValue) - Number(f.systemValue);
    return Number.isFinite(d) ? t + d : t;
  }, 0);
  const labelFixes = findings.filter((f) => (f.adjustmentTarget ?? defaultTarget(f.flaggedField)) !== "SYSTEM" && f.flaggedField !== "COUNT").length;
  const systemFixes = findings.filter((f) => f.flaggedField !== "COUNT" && (f.adjustmentTarget ?? defaultTarget(f.flaggedField)) !== "LABEL").length;
  const here = `/inventory-audit/adjustments/${id}${show === "all" ? "?show=all" : ""}`;

  return (
    <div className="max-w-6xl">
      <div className="print:hidden"><BackLink href={`/inventory-audit/audits/${id}`} label={audit.name} /></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Adjustments needed</h1>
          <p className="mt-1 text-sm text-gray-500">
            {audit.name} · {audit.facility.name} · {formatDate(audit.auditDate)}. What has to change as a result of the findings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link href={`/inventory-audit/review/${id}`} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Review findings{stats.toReview > 0 ? ` (${stats.toReview})` : ""}
          </Link>
          <a href={`/inventory-audit/adjustments/${id}/export?show=${show}`} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Download CSV</a>
          <PrintButton />
        </div>
      </div>

      {stats.toReview > 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
          {stats.toReview} finding{stats.toReview === 1 ? " hasn't" : "s haven't"} been reviewed yet, so their adjustments may still change.{" "}
          <Link href={`/inventory-audit/review/${id}`} className="font-medium underline">Review them</Link>
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          [String(counts.length), "Quantity adjustments"],
          [`${netQty > 0 ? "+" : ""}${Math.round(netQty * 1000) / 1000}`, "Net quantity change"],
          [String(systemFixes), "Dutchie field corrections"],
          [String(labelFixes), "Label corrections"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-semibold tabular-nums text-gray-900">{n}</p>
            <p className="mt-1 text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        {[["open", `Still to do (${stats.pendingAdjustments})`], ["all", "Including done"]].map(([k, label]) => (
          <Link key={k} href={`/inventory-audit/adjustments/${id}?show=${k}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${show === k ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{label}</Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>{["Item", "What to change", "Fix in", "Owner", "Status"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {findings.map((f) => {
              const target = f.adjustmentTarget ?? defaultTarget(f.flaggedField);
              return (
                <tr key={f.id} className="align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{f.auditLine ? lineLabel(f.auditLine) : "Item"}</p>
                    <p className="text-xs text-gray-500">{[f.auditLine?.pid && `PID ${f.auditLine.pid}`, f.auditLine?.batchId && `Batch ${f.auditLine.batchId}`, f.auditLine?.room].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{fieldLabel(f.flaggedField)}</p>
                    <p className="text-gray-900">{describeAdjustment({ flaggedField: f.flaggedField, systemValue: f.systemValue, foundValue: f.foundValue, unit: f.unit, target })}</p>
                    {f.monitoringNotes && <p className="mt-0.5 text-xs text-gray-500">“{f.monitoringNotes}”</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{TARGET[target]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {f.adjustmentStatus === "APPLIED" ? (
                      <span className="text-xs text-[#134229]">Done {formatDate(f.adjustedAt)}</span>
                    ) : (
                      <span className="text-xs text-amber-700">To do</span>
                    )}
                    <form action={setAdjustmentStatus} className="mt-1 flex gap-2 print:hidden">
                      <input type="hidden" name="findingId" value={f.id} />
                      <input type="hidden" name="back" value={here} />
                      {f.adjustmentStatus === "APPLIED" ? (
                        <button name="status" value="PENDING" className="text-xs text-gray-500 underline">Undo</button>
                      ) : (
                        <>
                          <button name="status" value="APPLIED" className="rounded border border-black bg-black px-2 py-0.5 text-xs font-medium text-white hover:bg-white hover:text-black">Mark done</button>
                          <button name="status" value="NOT_NEEDED" className="text-xs text-gray-500 underline">Not needed</button>
                        </>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
            {findings.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">{show === "open" ? "No adjustments left to make." : "No adjustments for this audit."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">Quantities are in each item&apos;s own unit, so the net change adds different units together — read it with the list above.</p>
    </div>
  );
}
