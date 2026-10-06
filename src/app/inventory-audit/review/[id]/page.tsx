import Link from "next/link";
import { notFound } from "next/navigation";
import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { getFormOptions } from "@/lib/ia/options";
import { auditStats } from "@/lib/ia/audits";
import { defaultTarget, fieldLabel, lineLabel } from "@/lib/ia/audit-rules";
import { toDateInput } from "@/lib/ia/dates";
import { CAN_RUN_AUDITS } from "@/lib/ia/workflow";
import { markAllReviewed, saveReview } from "../actions";

export const dynamic = "force-dynamic";
const box = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export default async function ReviewPage({ params, searchParams }: PageProps<"/inventory-audit/review/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getAuditSession(CAN_RUN_AUDITS);
  if (!me) notFound();

  const audit = await db.iaAudit.findUnique({ where: { id }, include: { facility: true } });
  if (!audit) notFound();

  const stats = await auditStats(id);
  const show = one(sp.show) === "all" ? "all" : one(sp.show) === "review" ? "review" : stats.toReview > 0 ? "review" : "all";
  const [opts, findings] = await Promise.all([
    getFormOptions(),
    db.iaFinding.findMany({
      where: { auditId: id, ...(show === "review" ? { needsReview: true } : {}) },
      orderBy: [{ foundAt: "asc" }],
      include: { auditLine: { select: { position: true, product: true, strain: true, batchId: true, pid: true, serialNo: true, room: true } } },
    }),
  ]);
  const here = `/inventory-audit/review/${id}${show === "all" ? "?show=all" : ""}`;

  return (
    <div className="max-w-6xl">
      <BackLink href={`/inventory-audit/audits/${id}`} label={audit.name} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Review findings</h1>
          <p className="mt-1 text-sm text-gray-500">
            {audit.name} · {audit.facility.name}. The auditors captured these in the moment — set each one&apos;s category,
            department and owner, decide what adjustment (if any) it needs, and mark it reviewed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/inventory-audit/adjustments/${id}`} className="rounded-md border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:bg-white hover:text-black">
            Adjustments report
          </Link>
          {stats.toReview > 0 && (
            <form action={markAllReviewed}>
              <input type="hidden" name="auditId" value={id} />
              <button className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Mark all {stats.toReview} reviewed
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {[["review", `Needs review (${stats.toReview})`], ["all", "All findings"]].map(([k, label]) => (
          <Link key={k} href={`/inventory-audit/review/${id}?show=${k}`}
            className={`rounded-full px-3 py-1 text-sm font-medium ${show === k ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{label}</Link>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {findings.map((f) => (
          <li key={f.id} className={`rounded-xl border p-4 ${f.needsReview ? "border-amber-200 bg-amber-50/40" : "border-gray-200 bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {f.auditLine ? lineLabel({ ...f.auditLine, position: f.auditLine.position }) : "Item"} — {fieldLabel(f.flaggedField)}
                </p>
                <p className="text-xs text-gray-500">
                  {[f.auditLine?.pid && `PID ${f.auditLine.pid}`, f.auditLine?.batchId && `Batch ${f.auditLine.batchId}`, f.auditLine?.room].filter(Boolean).join(" · ")}
                  {" · found "}{f.foundAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <Link href={`/inventory-audit/findings/${f.id}`} className="text-xs text-[#134229] underline">Open finding</Link>
            </div>
            <p className="mt-1 text-sm text-gray-700">
              System: <strong className="font-medium">{f.systemValue ?? "—"}</strong> → Found: <strong className="font-medium">{f.foundValue ?? "—"}</strong>
            </p>
            {f.monitoringNotes && <p className="mt-0.5 text-sm text-gray-500">“{f.monitoringNotes}”</p>}

            <form action={saveReview} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="findingId" value={f.id} />
              <input type="hidden" name="back" value={here} />
              <label className="text-xs text-gray-500">Category
                <select name="categoryId" defaultValue={f.categoryId ?? ""} className={`${box} mt-0.5 block max-w-[16rem]`}>
                  <option value="">None</option>
                  {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Department
                <select name="departmentId" defaultValue={f.departmentId} className={`${box} mt-0.5 block`}>
                  {opts.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Assign to
                <select name="assignedToId" defaultValue={f.assignedToId ?? ""} className={`${box} mt-0.5 block`}>
                  <option value="">Nobody yet</option>
                  {opts.assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Due
                <input type="date" name="dueDate" defaultValue={toDateInput(f.dueDate)} className={`${box} mt-0.5 block`} />
              </label>
              <label className="text-xs text-gray-500">Adjustment
                <select name="adjustmentNeeded" defaultValue={f.adjustmentStatus === "NOT_NEEDED" ? "no" : "yes"} className={`${box} mt-0.5 block`} disabled={f.adjustmentStatus === "APPLIED"}>
                  <option value="yes">Needed</option>
                  <option value="no">Not needed</option>
                </select>
              </label>
              {f.flaggedField === "COUNT" && (
                <label className="text-xs text-gray-500">Adjustment reason
                  <select name="adjustmentReasonId" defaultValue={f.adjustmentReasonId ?? ""} className={`${box} mt-0.5 block`}>
                    <option value="">No reason yet</option>
                    {opts.reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs text-gray-500">Fix in
                <select name="adjustmentTarget" defaultValue={f.adjustmentTarget ?? defaultTarget(f.flaggedField)} className={`${box} mt-0.5 block`}>
                  <option value="SYSTEM">Dutchie</option>
                  <option value="LABEL">The label</option>
                  <option value="BOTH">Both</option>
                </select>
              </label>
              <button className="rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black">
                {f.needsReview ? "Save & mark reviewed" : "Save"}
              </button>
            </form>
          </li>
        ))}
        {findings.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
            {show === "review" ? "Nothing waiting for review." : "No findings in this audit."}
          </li>
        )}
      </ul>
    </div>
  );
}
