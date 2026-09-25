import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CheckoutsPage() {
  const events = await db.checkoutEvent.findMany({
    orderBy: { occurredAt: "desc" },
    include: { site: true, employee: true, lines: { include: { item: true } } },
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Checkouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every checkout is tied to a real employee, with an optional purpose.
          </p>
        </div>
        <Link
          href="/checkouts/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New checkout
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Site</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Employee
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Items</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Purpose
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-gray-600">
                  {e.occurredAt.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-gray-900">{e.site.name}</td>
                <td className="px-4 py-2 text-gray-900">{e.employee.name}</td>
                <td className="px-4 py-2 text-gray-600">
                  {e.lines.map((l) => `${l.item.name} (${l.quantity})`).join(", ")}
                </td>
                <td className="px-4 py-2 text-gray-600">{e.purpose ?? "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.isReturn
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {e.isReturn ? "return" : "checkout"}
                  </span>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No checkouts recorded yet.{" "}
                  <Link href="/checkouts/new" className="text-emerald-700 underline">
                    Record one
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
