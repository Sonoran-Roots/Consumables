import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await db.vendor.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
          <p className="mt-1 text-sm text-gray-500">
            A real vendor list — the old system just typed vendor names on
            transaction rows with no master list at all.
          </p>
        </div>
        <Link
          href="/vendors/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New vendor
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vendors.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2 font-medium text-gray-900">{v.name}</td>
                <td className="px-4 py-2 text-gray-600">
                  {v.isActive ? "Active" : "Inactive"}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                  No vendors yet.{" "}
                  <Link href="/vendors/new" className="text-emerald-700 underline">
                    Add the first one
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
