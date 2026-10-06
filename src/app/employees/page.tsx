import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAnyAdmin } from "@/lib/access";
import EmployeeAccessCell from "./employee-access-cell";
import RemoveEmployeeButton from "./remove-employee-button";
import StandaloneAccountsTable from "./standalone-accounts-table";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const [session, employees, standaloneUsers] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    db.employee.findMany({
      orderBy: { name: "asc" },
      include: {
        site: true,
        user: {
          select: { id: true, email: true, role: true, isPurchasingTeam: true, auditRole: true },
        },
      },
    }),
    // Accounts with no linked employee — the shared, location-signed-in
    // kiosk logins fall here, not among "people."
    db.user.findMany({
      where: { employee: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, isPurchasingTeam: true },
    }),
  ]);

  const isAdmin = !!session && isAnyAdmin(session.user as { role?: string; auditRole?: string | null });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">
            One list of people for every module. Set each person&apos;s access level in Consumable Management and Inventory Audit, and manage their login
            (email, password, sign-out) from their page.
          </p>
        </div>
        <Link
          href="/employees/new"
          className="shrink-0 whitespace-nowrap rounded-md border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:bg-white hover:text-black"
        >
          New employee
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Home site</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Module access</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <Link href={`/employees/${e.id}/edit`} className="hover:underline">
                    {e.name}
                  </Link>
                  {!e.isActive && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-600">{e.site?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <EmployeeAccessCell
                    employeeId={e.id}
                    employeeName={e.name}
                    user={e.user}
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/employees/${e.id}/edit`}
                    className="text-xs text-[#134229] hover:underline"
                  >
                    edit
                  </Link>
                  {isAdmin && (e.isActive || e.user) && e.user?.id !== session?.user.id && (
                    <RemoveEmployeeButton
                      employeeId={e.id}
                      employeeName={e.name}
                      hasLogin={!!e.user}
                    />
                  )}
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No employees yet.{" "}
                  <Link href="/employees/new" className="text-[#134229] underline">
                    Add the first one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && standaloneUsers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-700">Other accounts</h2>
          <p className="mt-1 text-xs text-gray-500">
            Logins with no linked employee — typically the shared accounts kiosk tablets sign into.
          </p>
          <div className="mt-2">
            <StandaloneAccountsTable users={standaloneUsers} />
          </div>
        </div>
      )}
    </div>
  );
}
