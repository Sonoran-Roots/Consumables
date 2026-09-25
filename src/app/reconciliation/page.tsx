import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function ReconciliationListPage() {
  const reconciliations = await db.inventoryReconciliation.findMany({
    orderBy: { periodStart: "desc" },
    include: { site: true, _count: { select: { lines: true } } },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Inventory reconciliation
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Period-close snapshots of ending inventory, transfer costs, and
            usage rates per site — closing requires a finalized physical
            audit for that site to be linked.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reconciliation/report"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Usage report
          </Link>
          <Link
            href="/reconciliation/new"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            New reconciliation
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Site</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Period</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Lines</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reconciliations.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <Link href={`/reconciliation/${r.id}`} className="hover:underline">
                    {r.site.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                </td>
                <td className="px-4 py-2 text-gray-600">{r._count.lines}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "CLOSED"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "CANCELLED"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/reconciliation/${r.id}`}
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    view
                  </Link>
                </td>
              </tr>
            ))}
            {reconciliations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No reconciliations yet.{" "}
                  <Link href="/reconciliation/new" className="text-emerald-700 underline">
                    Start one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
