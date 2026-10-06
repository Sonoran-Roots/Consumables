import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAnyAdmin } from "@/lib/access";
import BackLink from "@/components/back-link";
import EmployeeEditForm from "./employee-edit-form";
import AccountPanel from "./account-panel";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: PageProps<"/employees/[id]/edit">) {
  const { id } = await params;

  const [session, employee, sites] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    // omit the PIN digest — no reason to ship it to the client
    db.employee.findUnique({ where: { id }, omit: { pinDigest: true } }),
    db.site.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!employee) notFound();

  const isAdmin = !!session && isAnyAdmin(session.user as { role?: string; auditRole?: string | null });
  const user = isAdmin && employee.userId
    ? await db.user.findUnique({ where: { id: employee.userId }, select: { id: true, name: true, email: true, role: true, isPurchasingTeam: true, auditRole: true } })
    : null;
  const hasPin = (await db.employee.count({ where: { id, pinDigest: { not: null } } })) > 0;

  return (
    <div className="max-w-xl">
      <BackLink href="/employees" label="Back to employees" />
      <h1 className="text-xl font-semibold text-gray-900">{employee.name}</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <EmployeeEditForm employee={employee} sites={sites} hasPin={hasPin} />
      </div>

      {isAdmin && (
        <div className="mt-6">
          <AccountPanel employeeId={employee.id} employeeName={employee.name} user={user} isSelf={!!user && user.id === session?.user.id} />
        </div>
      )}
    </div>
  );
}
