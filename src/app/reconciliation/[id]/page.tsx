import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import {
  refreshReconciliation,
  reopenReconciliation,
  deleteReconciliation,
  startAuditForReconciliation,
} from "../actions";
import DeleteReconciliationButton from "./delete-reconciliation-button";
import CloseReconciliationForm from "./close-reconciliation-form";
import LinkAuditForm from "./link-audit-form";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString();
}
function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function ReconciliationDetailPage({
  params,
}: PageProps<"/reconciliation/[id]">) {
  const { id } = await params;

  const [reconciliation, employees] = await Promise.all([
    db.inventoryReconciliation.findUnique({
      where: { id },
      include: {
        site: true,
        closedBy: true,
        audit: true,
        lines: { include: { item: true }, orderBy: { item: { name: "asc" } } },
      },
    }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!reconciliation) notFound();

  const isOpen = reconciliation.status === "OPEN";

  const auditCandidates = reconciliation.audit
    ? []
    : await db.audit.findMany({
        where: { siteId: reconciliation.siteId },
        orderBy: { auditDate: "desc" },
      });

  const totals = reconciliation.lines.reduce(
    (acc, l) => ({
      endingValue: acc.endingValue + (l.endingValue ?? 0),
      purchasedValue: acc.purchasedValue + l.purchasedValue,
      transferInValue: acc.transferInValue + l.transferInValue,
      transferOutValue: acc.transferOutValue + l.transferOutValue,
    }),
    { endingValue: 0, purchasedValue: 0, transferInValue: 0, transferOutValue: 0 }
  );

  return (
    <div className="max-w-5xl space-y-6">
      <BackLink href="/reconciliation" label="Back to reconciliation" />

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            {reconciliation.site.name}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              reconciliation.status === "CLOSED"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {reconciliation.status}
          </span>
          <Link
            href={`/reconciliation/${reconciliation.id}/edit`}
            className="text-xs text-emerald-700 hover:underline"
          >
            edit
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {fmtDate(reconciliation.periodStart)} – {fmtDate(reconciliation.periodEnd)}
        </p>
        {reconciliation.notes && (
          <p className="mt-1 text-sm text-gray-500">{reconciliation.notes}</p>
        )}
        {reconciliation.status === "CLOSED" && reconciliation.closedAt && (
          <p className="mt-1 text-sm text-emerald-700">
            Closed {fmtDateTime(reconciliation.closedAt)}
            {reconciliation.closedBy ? ` by ${reconciliation.closedBy.name}` : ""}.
            Figures are frozen as of that moment.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Ending value</div>
          <div className="text-lg font-semibold text-gray-900">
            {money(totals.endingValue)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Purchased</div>
          <div className="text-lg font-semibold text-gray-900">
            {money(totals.purchasedValue)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Transferred in</div>
          <div className="text-lg font-semibold text-gray-900">
            {money(totals.transferInValue)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Transferred out</div>
          <div className="text-lg font-semibold text-gray-900">
            {money(totals.transferOutValue)}
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700">Linked audit</h2>
        <p className="mt-1 text-xs text-gray-500">
          A finalized audit for {reconciliation.site.name} must be linked
          before this can close.
        </p>
        {reconciliation.audit ? (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Link
              href={`/audits/${reconciliation.audit.id}`}
              className="text-emerald-700 hover:underline"
            >
              {reconciliation.audit.auditDate.toLocaleDateString(undefined, {
                timeZone: "UTC",
              })}
            </Link>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                reconciliation.audit.status === "FINALIZED"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {reconciliation.audit.status === "FINALIZED"
                ? "Finalized"
                : "In progress — not finalized yet"}
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <form action={startAuditForReconciliation}>
              <input type="hidden" name="reconciliationId" value={reconciliation.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Start a new audit for this site
              </button>
            </form>
            {auditCandidates.length > 0 && (
              <LinkAuditForm
                reconciliationId={reconciliation.id}
                candidates={auditCandidates}
              />
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {isOpen && (
          <form action={refreshReconciliation}>
            <input type="hidden" name="reconciliationId" value={reconciliation.id} />
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Refresh figures
            </button>
          </form>
        )}
        {isOpen && (
          <CloseReconciliationForm
            reconciliationId={reconciliation.id}
            employees={employees}
          />
        )}
        {!isOpen && (
          <form action={reopenReconciliation}>
            <input type="hidden" name="reconciliationId" value={reconciliation.id} />
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Reopen
            </button>
          </form>
        )}
        <form action={deleteReconciliation}>
          <input type="hidden" name="reconciliationId" value={reconciliation.id} />
          <DeleteReconciliationButton />
        </form>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Line items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="py-1.5 pr-3 text-left font-medium text-gray-500">Item</th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Beginning
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Ending
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Unit cost
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Ending value
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Purchased
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Transfer in
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Transfer out
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Consumed
                </th>
                <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                  Usage/day
                </th>
                <th className="py-1.5 text-right font-medium text-gray-500">
                  Discrepancy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reconciliation.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-3 text-gray-900">{l.item.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {l.beginningQty}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{l.endingQty}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">
                    {l.unitCost != null ? money(l.unitCost) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">
                    {l.endingValue != null ? money(l.endingValue) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {l.purchasedQty || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {l.transferInQty || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {l.transferOutQty || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {l.consumedQty || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">
                    {l.usageRatePerDay != null ? l.usageRatePerDay.toFixed(2) : "—"}
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${
                      l.discrepancyQty ? "font-medium text-amber-700" : "text-gray-400"
                    }`}
                  >
                    {l.discrepancyQty || "—"}
                  </td>
                </tr>
              ))}
              {reconciliation.lines.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-gray-400">
                    No item activity found at this site during the period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
