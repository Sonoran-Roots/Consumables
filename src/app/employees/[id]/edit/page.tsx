import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import EmployeeEditForm from "./employee-edit-form";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: PageProps<"/employees/[id]/edit">) {
  const { id } = await params;

  const [employee, sites] = await Promise.all([
    db.employee.findUnique({ where: { id } }),
    db.site.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!employee) notFound();

  return (
    <div className="max-w-md">
      <BackLink href="/employees" label="Back to employees" />
      <h1 className="text-xl font-semibold text-gray-900">Edit employee</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <EmployeeEditForm employee={employee} sites={sites} />
      </div>
    </div>
  );
}
