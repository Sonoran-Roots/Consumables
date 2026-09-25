import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({
    orderBy: { name: "asc" },
    include: { site: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real accountability for checkouts and transfers — no more 2-letter
            initials.
          </p>
        </div>
        <Link
          href="/employees/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New employee
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Initials
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Home site
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 font-medium text-gray-900">{e.name}</td>
                <td className="px-4 py-2 text-gray-600">{e.initials ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">{e.site?.name ?? "—"}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  No employees yet.{" "}
                  <Link href="/employees/new" className="text-emerald-700 underline">
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
