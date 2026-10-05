import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { isAuditRole } from "@/lib/access";
import { getFormOptions } from "@/lib/ia/options";
import { formatDate } from "@/lib/ia/dates";
import { CAN_ENTER_FINDINGS, isOverdue } from "@/lib/ia/workflow";
import StatusBadge from "../_components/status-badge";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const select = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

export default async function FindingsPage({ searchParams }: PageProps<"/inventory-audit/findings">) {
  const sp = await searchParams;
  const status = one(sp.status), facilityId = one(sp.facility), departmentId = one(sp.department);
  const typeId = one(sp.type), q = one(sp.q).trim(), overdueOnly = one(sp.overdue) === "1";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { auditRole?: string | null } | undefined)?.auditRole;
  const canEnter = isAuditRole(role) && CAN_ENTER_FINDINGS.includes(role);

  const where: Prisma.IaFindingWhereInput = {
    ...(status ? { status: status as Prisma.IaFindingWhereInput["status"] } : {}),
    ...(facilityId ? { facilityId } : {}),
    ...(departmentId ? { OR: [{ departmentId }, { secondDepartmentId: departmentId }] } : {}),
    ...(typeId ? { findingTypeId: typeId } : {}),
    ...(overdueOnly ? { status: { in: ["OPEN", "NOTIFIED"] }, dueDate: { lt: new Date() } } : {}),
    ...(q
      ? { AND: [{ OR: [
          { description: { contains: q, mode: "insensitive" } }, { product: { contains: q, mode: "insensitive" } },
          { batchId: { contains: q, mode: "insensitive" } }, { pid: { contains: q, mode: "insensitive" } },
        ] }] }
      : {}),
  };

  const [opts, total, findings] = await Promise.all([
    getFormOptions(),
    db.iaFinding.count({ where }),
    db.iaFinding.findMany({
      where,
      orderBy: [{ auditDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { facility: true, department: true, findingType: true, assignedTo: { select: { name: true, email: true } } },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, val] of Object.entries({ status, facility: facilityId, department: departmentId, type: typeId, q, overdue: overdueOnly ? "1" : "" })) if (val) u.set(k, val);
    u.set("page", String(p));
    return `/inventory-audit/findings?${u}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Findings</h1>
          <p className="mt-1 text-sm text-gray-500">{total.toLocaleString("en-US")} finding{total === 1 ? "" : "s"}</p>
        </div>
        {canEnter && (
          <Link href="/inventory-audit/findings/new" className="shrink-0 whitespace-nowrap rounded-md border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:bg-white hover:text-black">
            Add finding
          </Link>
        )}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="Search finding, product, batch, PID" className={`${select} w-64`} />
        <select name="status" defaultValue={status} className={select}>
          <option value="">Any status</option>
          <option value="OPEN">Open</option><option value="NOTIFIED">Notified</option>
          <option value="RESOLVED">Resolved</option><option value="VERIFIED">Verified</option>
        </select>
        <select name="facility" defaultValue={facilityId} className={select}>
          <option value="">All facilities</option>
          {opts.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select name="department" defaultValue={departmentId} className={select}>
          <option value="">All departments</option>
          {opts.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="type" defaultValue={typeId} className={select}>
          <option value="">All types</option>
          {opts.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" name="overdue" value="1" defaultChecked={overdueOnly} /> Overdue only
        </label>
        <button className="rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black">Filter</button>
        <Link href="/inventory-audit/findings" className="text-sm text-gray-500 hover:underline">Clear</Link>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Audited", "Facility", "Department", "Type", "Finding", "Status", "Due", "Assigned"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {findings.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(f.auditDate)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.facility.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.department.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.findingType.name}</td>
                <td className="max-w-md px-3 py-2">
                  <Link href={`/inventory-audit/findings/${f.id}`} className="font-medium text-gray-900 hover:underline">
                    {f.description.length > 90 ? `${f.description.slice(0, 90)}…` : f.description}
                  </Link>
                  {f.product && <p className="truncate text-xs text-gray-400">{f.product}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2"><StatusBadge status={f.status} overdue={isOverdue(f)} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(f.dueDate)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "—"}</td>
              </tr>
            ))}
            {findings.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No findings match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>Page {page} of {pages}</span>
          <span className="flex gap-3">
            {page > 1 && <Link href={link(page - 1)} className="hover:underline">← Previous</Link>}
            {page < pages && <Link href={link(page + 1)} className="hover:underline">Next →</Link>}
          </span>
        </div>
      )}
    </div>
  );
}
