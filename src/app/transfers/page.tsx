import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  IN_TRANSIT: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function TransfersPage() {
  const transfers = await db.transfer.findMany({
    orderBy: { requestedAt: "desc" },
    include: { fromSite: true, toSite: true, lines: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every transfer has a real header, a status, and works across books.
          </p>
        </div>
        <Link
          href="/transfers/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New transfer
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">From</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">To</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Items</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Requested
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transfers.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-gray-900">
                  <Link
                    href={`/transfers/${t.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {t.fromSite.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-900">{t.toSite.name}</td>
                <td className="px-4 py-2 text-gray-600">{t.lines.length} line(s)</td>
                <td className="px-4 py-2 text-gray-600">
                  {t.requestedAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/transfers/${t.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No transfers yet.{" "}
                  <Link href="/transfers/new" className="text-emerald-700 underline">
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
