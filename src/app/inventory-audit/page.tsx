import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { findingScope } from "@/lib/ia/scope";
import { formatDate } from "@/lib/ia/dates";
import StatusBadge from "./_components/status-badge";
import { CAN_ENTER_FINDINGS, isOverdue, overdueCutoff } from "@/lib/ia/workflow";

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
  const me = await getAuditSession();
  const scope: Prisma.IaFindingWhereInput = me ? await findingScope(me) : { id: "" };

  const canAudit = me !== null && CAN_ENTER_FINDINGS.includes(me.role);
  const [byStatus, overdue, byFacility, recent, inProgress] = await Promise.all([
    db.iaFinding.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.iaFinding.count({ where: { AND: [scope, { status: { in: ["OPEN", "NOTIFIED"] }, dueDate: { lt: overdueCutoff(now) } }] } }),
    db.iaFinding.groupBy({ by: ["facilityId"], where: { AND: [scope, { status: { in: ["OPEN", "NOTIFIED"] } }] }, _count: { _all: true }, orderBy: { _count: { facilityId: "desc" } }, take: 8 }),
    db.iaFinding.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 6, include: { facility: true, department: true } }),
    canAudit ? db.iaAudit.findMany({ where: { status: "IN_PROGRESS" }, orderBy: { createdAt: "desc" }, take: 5, include: { facility: true, _count: { select: { lines: true } } } }) : Promise.resolve([]),
  ]);
  const facilities = await db.iaFacility.findMany({ where: { id: { in: byFacility.map((d) => d.facilityId) } }, select: { id: true, name: true } });
  const facilityName = new Map(facilities.map((f) => [f.id, f.name]));
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

      {inProgress.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-gray-700">Audits in progress</h2>
          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm">
            {inProgress.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link href={`/inventory-audit/audits/${a.id}`} className="min-w-0 truncate font-medium text-gray-900 hover:underline">{a.name}</Link>
                <span className="shrink-0 text-xs text-gray-400">{a.facility.name} · {a._count.lines.toLocaleString("en-US")} lines</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {overdue > 0 && me && CAN_ENTER_FINDINGS.includes(me.role) && (
        <p className="mt-3 text-sm text-gray-600">
          {overdue.toLocaleString("en-US")} finding{overdue === 1 ? " is" : "s are"} past due.{" "}
          <Link href="/inventory-audit/email?show=overdue" className="font-medium text-gray-900 underline">Draft reminder emails</Link>
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-gray-700">Open work by location</h2>
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <tbody className="divide-y divide-gray-100">
                {byFacility.map((d) => (
                  <tr key={d.facilityId}>
                    <td className="px-4 py-2 text-gray-900">
                      <Link href={`/inventory-audit/findings?facility=${d.facilityId}`} className="hover:underline">{facilityName.get(d.facilityId) ?? "—"}</Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">{d._count._all}</td>
                  </tr>
                ))}
                {byFacility.length === 0 && <tr><td className="px-4 py-6 text-center text-gray-400">Nothing open.</td></tr>}
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
