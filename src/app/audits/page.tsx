import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  const audits = await db.audit.findMany({
    orderBy: { auditDate: "desc" },
    include: { site: true, performedBy: true, lines: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audits</h1>
          <p className="mt-1 text-sm text-gray-500">
            Replaces the monthly spreadsheet-tab physical counts — variances
            post automatically as discrepancy transactions when finalized.
          </p>
        </div>
        <Link
          href="/audits/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New audit
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Site</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Performed by
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Lines</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {audits.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2 text-gray-600">
                  <Link
                    href={`/audits/${a.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {a.auditDate.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-900">{a.site.name}</td>
                <td className="px-4 py-2 text-gray-600">
                  {a.performedBy?.name ?? "—"}
                </td>
                <td className="px-4 py-2 text-gray-600">{a.lines.length}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === "FINALIZED"
                        ? "bg-emerald-100 text-emerald-800"
                        : a.status === "CANCELLED"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {a.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/audits/${a.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {audits.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No audits yet.{" "}
                  <Link href="/audits/new" className="text-emerald-700 underline">
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
