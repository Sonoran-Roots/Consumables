import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/ia/dates";
import StatusBadge from "./_components/status-badge";
import { isOverdue } from "@/lib/ia/workflow";

export const dynamic = "force-dynamic";

const STATUSES = [
  { key: "OPEN", label: "Open" },
  { key: "NOTIFIED", label: "Notified" },
  { key: "RESOLVED", label: "Awaiting verification" },
  { key: "VERIFIED", label: "Verified" },
] as const;

export default async function InventoryAuditHome({ searchParams }: PageProps<"/inventory-audit">) {
  const params = await searchParams;
  const now = new Date();

  const [byStatus, overdue, byDepartment, recent] = await Promise.all([
    db.iaFinding.groupBy({ by: ["status"], _count: { _all: true } }),
    db.iaFinding.count({ where: { status: { in: ["OPEN", "NOTIFIED"] }, dueDate: { lt: now } } }),
    db.iaFinding.groupBy({ by: ["departmentId"], where: { status: { in: ["OPEN", "NOTIFIED"] } }, _count: { _all: true }, orderBy: { _count: { departmentId: "desc" } }, take: 8 }),
    db.iaFinding.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { facility: true, department: true } }),
  ]);
  const departments = await db.iaDepartment.findMany({ where: { id: { in: byDepartment.map((d) => d.departmentId) } }, select: { id: true, name: true } });
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;

  return (
    <div className="max-w-5xl">
      {params.denied === "1" && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your access level doesn&apos;t include that page.
        </p>
      )}
      <h1 className="text-xl font-semibold text-gray-900">Inventory Audit</h1>
      <p className="mt-1 text-sm text-gray-500">Findings from inventory audits, followed through to resolution.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STATUSES.map((s) => (
          <Link key={s.key} href={`/inventory-audit/findings?status=${s.key}`} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-black">
            <p className="text-2xl font-semibold text-gray-900">{count(s.key).toLocaleString("en-US")}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </Link>
        ))}
        <Link href="/inventory-audit/findings?overdue=1" className={`rounded-lg border p-4 hover:border-black ${overdue > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className={`text-2xl font-semibold ${overdue > 0 ? "text-red-700" : "text-gray-900"}`}>{overdue.toLocaleString("en-US")}</p>
          <p className="mt-1 text-sm text-gray-500">Overdue</p>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-gray-700">Open work by department</h2>
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <tbody className="divide-y divide-gray-100">
                {byDepartment.map((d) => (
                  <tr key={d.departmentId}>
                    <td className="px-4 py-2 text-gray-900">
                      <Link href={`/inventory-audit/findings?department=${d.departmentId}`} className="hover:underline">{deptName.get(d.departmentId) ?? "—"}</Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">{d._count._all}</td>
                  </tr>
                ))}
                {byDepartment.length === 0 && <tr><td className="px-4 py-6 text-center text-gray-400">Nothing open.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700">Latest findings</h2>
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100 text-sm">
              {recent.map((f) => (
                <li key={f.id} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/inventory-audit/findings/${f.id}`} className="min-w-0 truncate font-medium text-gray-900 hover:underline">{f.description}</Link>
                    <StatusBadge status={f.status} overdue={isOverdue(f)} />
                  </div>
                  <p className="text-xs text-gray-400">{f.facility.name} · {f.department.name} · {formatDate(f.auditDate)}</p>
                </li>
              ))}
              {recent.length === 0 && <li className="px-4 py-6 text-center text-gray-400">No findings yet.</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
