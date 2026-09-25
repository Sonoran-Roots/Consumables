import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-800",
  FULLY_RECEIVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default async function PurchasingPage() {
  const orders = await db.purchaseOrder.findMany({
    orderBy: { orderDate: "desc" },
    include: { site: true, vendor: true, lines: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Replaces the separate Purchasing/EOM Prepaid Inventory workbook —
            receiving progress, payments, and vendor credits in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/vendors"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Vendors
          </Link>
          <Link
            href="/purchasing/new"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            New PO
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                PO number
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Vendor</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Site</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Order date
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Total</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Paid</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((po) => (
              <tr key={po.id}>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/purchasing/${po.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {po.poNumber}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-900">{po.vendor.name}</td>
                <td className="px-4 py-2 text-gray-600">{po.site.name}</td>
                <td className="px-4 py-2 text-gray-600">
                  {po.orderDate.toLocaleDateString(undefined, { timeZone: "UTC" })}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                  $
                  {po.lines
                    .reduce((sum, l) => sum + l.quantityOrdered * l.unitCost, 0)
                    .toFixed(2)}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {po.paidInFull ? "Yes" : "No"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[po.status]}`}
                  >
                    {po.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/purchasing/${po.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  No purchase orders yet.{" "}
                  <Link href="/purchasing/new" className="text-emerald-700 underline">
                    Create one
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
