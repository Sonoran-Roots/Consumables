import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import AuditForm from "./audit-form";

export const dynamic = "force-dynamic";

export default async function NewAuditPage() {
  const [sites, employees] = await Promise.all([
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-md">
      <BackLink href="/audits" label="Back to audits" />
      <h1 className="text-xl font-semibold text-gray-900">New audit</h1>
      <p className="mt-1 text-sm text-gray-500">
        Snapshots current on-hand quantities for every item at the site, so you
        can enter physical counts against them.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <AuditForm sites={sites} employees={employees} />
      </div>
    </div>
  );
}
