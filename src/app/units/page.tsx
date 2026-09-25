import Link from "next/link";
import { db } from "@/lib/db";
import { deleteUnit } from "./actions";
import DeleteUnitButton from "./delete-unit-button";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const units = await db.unitOfMeasure.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Units of measure</h1>
          <p className="mt-1 text-sm text-gray-500">
            Unit, Bundle, Case, Box, Gallon, Roll, etc.
          </p>
        </div>
        <Link
          href="/units/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New unit
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Code</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Description
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Items</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {units.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <Link href={`/units/${u.id}/edit`} className="hover:underline">
                    {u.code}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{u.description ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">{u._count.items}</td>
                <td className="px-4 py-2 text-right">
                  <span className="flex items-center justify-end gap-2">
                    <Link
                      href={`/units/${u.id}/edit`}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      edit
                    </Link>
                    {u._count.items === 0 ? (
                      <form action={deleteUnit}>
                        <input type="hidden" name="unitId" value={u.id} />
                        <DeleteUnitButton unitCode={u.code} />
                      </form>
                    ) : (
                      <span
                        className="text-xs text-gray-300"
                        title="Reassign items using this unit before deleting it"
                      >
                        delete
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No units yet.{" "}
                  <Link href="/units/new" className="text-emerald-700 underline">
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
