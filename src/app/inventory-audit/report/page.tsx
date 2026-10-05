import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { findingScope } from "@/lib/ia/scope";
import { baseWhere, inPeriod, readReportFilters } from "@/lib/ia/report";
import { formatDate, toDateInput } from "@/lib/ia/dates";
import { CAN_ENTER_FINDINGS, isOverdue, type FindingStatus } from "@/lib/ia/workflow";
import { getFormOptions } from "@/lib/ia/options";
import StatusBadge from "../_components/status-badge";

export const dynamic = "force-dynamic";

const select = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

type Tally = { total: number; OPEN: number; NOTIFIED: number; RESOLVED: number; VERIFIED: number; overdue: number };
const blank = (): Tally => ({ total: 0, OPEN: 0, NOTIFIED: 0, RESOLVED: 0, VERIFIED: 0, overdue: 0 });

function Breakdown({ title, rows }: { title: string; rows: [string, Tally][] }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
              {["Total", "Open", "Notified", "Resolved", "Verified", "Overdue"].map((h) => (
                <th key={h} className="px-3 py-2 text-right font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(([name, t]) => (
              <tr key={name}>
                <td className="px-3 py-1.5 text-gray-900">{name}</td>
                {[t.total, t.OPEN, t.NOTIFIED, t.RESOLVED, t.VERIFIED].map((n, i) => (
                  <td key={i} className="px-3 py-1.5 text-right tabular-nums text-gray-600">{n || "—"}</td>
                ))}
                <td className={`px-3 py-1.5 text-right tabular-nums ${t.overdue ? "font-medium text-red-700" : "text-gray-400"}`}>{t.overdue || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400">No findings in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ReportPage({ searchParams }: PageProps<"/inventory-audit/report">) {
  const sp = await searchParams;
  const me = await getAuditSession();
  const isManager = me?.role === "MANAGER";
  const scope: Prisma.IaFindingWhereInput = me ? await findingScope(me) : { id: "" };
  const filters = readReportFilters(sp);
  const base = await baseWhere(filters, !isManager);
  const now = new Date();

  const periodWhere: Prisma.IaFindingWhereInput = { AND: [scope, base, inPeriod(filters)] };
  const [opts, managers, inPeriodRows, attention, attentionTotal] = await Promise.all([
    getFormOptions(),
    isManager ? Promise.resolve([]) : db.user.findMany({ where: { auditRole: { in: ["MANAGER", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    db.iaFinding.findMany({
      where: periodWhere,
      select: { status: true, dueDate: true, department: { select: { name: true } }, facility: { select: { name: true } }, findingType: { select: { name: true } }, category: { select: { name: true } } },
    }),
    db.iaFinding.findMany({
      where: { AND: [scope, base, { status: { in: ["OPEN", "NOTIFIED"] } }] },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { auditDate: "asc" }],
      take: 100,
      include: { facility: true, department: true, findingType: true, assignedTo: { select: { name: true, email: true } } },
    }),
    db.iaFinding.count({ where: { AND: [scope, base, { status: { in: ["OPEN", "NOTIFIED"] } }] } }),
  ]);

  const total = blank();
  const by = { department: new Map<string, Tally>(), type: new Map<string, Tally>(), category: new Map<string, Tally>(), facility: new Map<string, Tally>() };
  const add = (m: Map<string, Tally>, key: string, status: FindingStatus, overdue: boolean) => {
    const t = m.get(key) ?? blank();
    t.total++; t[status]++; if (overdue) t.overdue++;
    m.set(key, t);
  };
  for (const r of inPeriodRows) {
    const overdue = isOverdue({ status: r.status, dueDate: r.dueDate }, now);
    total.total++; total[r.status]++; if (overdue) total.overdue++;
    add(by.department, r.department.name, r.status, overdue);
    add(by.type, r.findingType.name, r.status, overdue);
    add(by.category, r.category?.name ?? "(no category)", r.status, overdue);
    add(by.facility, r.facility.name, r.status, overdue);
  }
  const sorted = (m: Map<string, Tally>) => [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  const done = total.RESOLVED + total.VERIFIED;

  const qs = new URLSearchParams();
  qs.set("from", toDateInput(filters.from));
  qs.set("to", toDateInput(filters.to));
  for (const [k, v] of Object.entries({ facility: filters.facilityId, department: filters.departmentId, type: filters.typeId, manager: filters.routedTo })) if (v) qs.set(k, v);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Findings report</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isManager ? "The findings routed to you — assigned to you, or in your locations and departments." : "All findings, or what a given manager sees."}
          </p>
        </div>
        <a href={`/inventory-audit/report/export?${qs}`} className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Download CSV
        </a>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2" method="get">
        <label className="text-xs text-gray-500">Audited from<input type="date" name="from" defaultValue={toDateInput(filters.from)} className={`${select} mt-0.5 block`} /></label>
        <label className="text-xs text-gray-500">to<input type="date" name="to" defaultValue={toDateInput(filters.to)} className={`${select} mt-0.5 block`} /></label>
        <select name="facility" defaultValue={filters.facilityId} className={select}>
          <option value="">All facilities</option>
          {opts.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select name="department" defaultValue={filters.departmentId} className={select}>
          <option value="">All departments</option>
          {opts.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="type" defaultValue={filters.typeId} className={select}>
          <option value="">All types</option>
          {opts.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {!isManager && (
          <select name="manager" defaultValue={filters.routedTo} className={select} aria-label="View as manager">
            <option value="">Everyone&apos;s findings</option>
            {managers.map((m) => <option key={m.id} value={m.id}>As seen by {m.name || m.email}</option>)}
          </select>
        )}
        <button className="rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black">Update</button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Findings", total.total], ["Open", total.OPEN], ["Notified", total.NOTIFIED], ["Resolved", total.RESOLVED], ["Verified", total.VERIFIED],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-semibold text-gray-900">{(n as number).toLocaleString("en-US")}</p>
            <p className="mt-1 text-sm text-gray-500">{label}</p>
          </div>
        ))}
        <div className={`rounded-lg border p-4 ${total.overdue ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className={`text-2xl font-semibold ${total.overdue ? "text-red-700" : "text-gray-900"}`}>{total.overdue}</p>
          <p className="mt-1 text-sm text-gray-500">Overdue</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Audited {formatDate(filters.from)} – {formatDate(filters.to)}.{" "}
        {total.total > 0 && `${Math.round((done / total.total) * 100)}% resolved or verified.`}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Breakdown title="By department" rows={sorted(by.department)} />
        <Breakdown title="By finding type" rows={sorted(by.type)} />
        <Breakdown title="By category" rows={sorted(by.category).slice(0, 12)} />
        <Breakdown title="By facility" rows={sorted(by.facility)} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-gray-700">
          Needs attention — open and notified, any date ({attentionTotal.toLocaleString("en-US")})
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Due", "Audited", "Facility", "Department", "Type", "Finding", "Status", "Assigned"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attention.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(f.dueDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(f.auditDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.facility.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.department.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.findingType.name}</td>
                  <td className="max-w-md px-3 py-2">
                    <Link href={`/inventory-audit/findings/${f.id}`} className="font-medium text-gray-900 hover:underline">
                      {f.description.length > 90 ? `${f.description.slice(0, 90)}…` : f.description}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2"><StatusBadge status={f.status} overdue={isOverdue(f, now)} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "—"}</td>
                </tr>
              ))}
              {attention.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Nothing waiting on anyone.</td></tr>}
            </tbody>
          </table>
        </div>
        {attentionTotal > attention.length && (
          <p className="mt-2 text-xs text-gray-400">Showing the {attention.length} most urgent. <Link href="/inventory-audit/findings?status=OPEN" className="underline">See all open findings</Link>.</p>
        )}
        {me && CAN_ENTER_FINDINGS.includes(me.role) && attentionTotal > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            To tell managers about these, <Link href="/inventory-audit/email" className="underline">draft the emails</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
