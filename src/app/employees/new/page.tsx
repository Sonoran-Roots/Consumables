import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import EmployeeForm from "./employee-form";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const sites = await db.site.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-md">
      <BackLink href="/employees" label="Back to employees" />
      <h1 className="text-xl font-semibold text-gray-900">New employee</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <EmployeeForm sites={sites} />
      </div>
    </div>
  );
}
