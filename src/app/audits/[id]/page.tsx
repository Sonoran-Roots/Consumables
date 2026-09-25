import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import {
  updateAuditCounts,
  addAuditLine,
  cancelAudit,
  reactivateAudit,
} from "../actions";
import AuditHeaderForm from "./audit-header-form";

export const dynamic = "force-dynamic";

export default async function AuditDetailPage({
  params,
}: PageProps<"/audits/[id]">) {
  const { id } = await params;

  const audit = await db.audit.findUnique({
    where: { id },
    include: {
      site: true,
      performedBy: true,
      lines: { include: { item: true }, orderBy: { item: { name: "asc" } } },
    },
  });

  if (!audit) notFound();

  const isFinalized = audit.status === "FINALIZED";
  const isCancelled = audit.status === "CANCELLED";
  const isInProgress = audit.status === "IN_PROGRESS";

  const [availableItems, sites] = await Promise.all([
    db.item.findMany({
      where: { id: { notIn: audit.lines.map((l) => l.itemId) } },
      orderBy: { name: "asc" },
    }),
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
  ]);
  const employees = await db.employee.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-3xl">
      <BackLink href="/audits" label="Back to audits" />
      <h1 className="text-xl font-semibold text-gray-900">
        Audit: {audit.site.name}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {audit.auditDate.toLocaleDateString(undefined, { timeZone: "UTC" })}
        {audit.performedBy ? ` · performed by ${audit.performedBy.name}` : ""}
      </p>

      <AuditHeaderForm audit={audit} sites={sites} employees={employees} />

      {isFinalized && (
        <p className="mt-3 text-sm text-amber-700">
          This audit is finalized. Counts can still be edited below — saving
          will re-reconcile the posted discrepancy transactions to match.
        </p>
      )}

      {isCancelled && (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-sm text-gray-500">
            This audit was cancelled and never posted anything to the ledger.
          </p>
          <form action={reactivateAudit}>
            <input type="hidden" name="auditId" value={audit.id} />
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Reactivate
            </button>
          </form>
        </div>
      )}

      {!isCancelled && availableItems.length > 0 && (
        <form action={addAuditLine} className="mt-6 flex items-center gap-2">
          <input type="hidden" name="auditId" value={audit.id} />
          <select
            name="itemId"
            required
            className="w-full max-w-sm rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Add an item to count…</option>
            {availableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            + Add item
          </button>
        </form>
      )}

      <form action={updateAuditCounts} className="mt-4">
        <input type="hidden" name="auditId" value={audit.id} />

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  Item
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  System qty
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Ending quantity
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Variance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {audit.lines.map((line) => {
                const variance =
                  line.countedQty != null
                    ? line.countedQty - line.systemQtyAtAudit
                    : null;
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2 text-gray-900">{line.item.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {line.systemQtyAtAudit}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        name={`countedQty-${line.id}`}
                        type="number"
                        step="any"
                        defaultValue={line.countedQty ?? ""}
                        disabled={isCancelled}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        variance ? "font-medium text-amber-700" : "text-gray-400"
                      }`}
                    >
                      {variance != null ? (variance > 0 ? `+${variance}` : variance) : "—"}
                    </td>
                  </tr>
                );
              })}
              {audit.lines.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    This site had no on-hand inventory when the audit was started.
                    Add an item above to start counting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {audit.lines.length > 0 && !isCancelled && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              name="intent"
              value="save"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              {isFinalized ? "Save counts (re-reconcile)" : "Save counts"}
            </button>
            {!isFinalized && (
              <button
                type="submit"
                name="intent"
                value="finalize"
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Finalize audit
              </button>
            )}
          </div>
        )}
      </form>

      {isInProgress && (
        <form action={cancelAudit} className="mt-3">
          <input type="hidden" name="auditId" value={audit.id} />
          <button
            type="submit"
            className="text-sm text-red-600 hover:underline"
          >
            Cancel this audit
          </button>
        </form>
      )}
    </div>
  );
}
