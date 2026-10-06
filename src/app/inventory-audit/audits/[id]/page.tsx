import Link from "next/link";
import { notFound } from "next/navigation";
import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { auditStats, toLineView } from "@/lib/ia/audits";
import { defaultCategoryName } from "@/lib/ia/audit-rules";
import { formatDate } from "@/lib/ia/dates";
import { CAN_CONFIGURE, CAN_ENTER_FINDINGS, isOverdue } from "@/lib/ia/workflow";
import StatusBadge from "../../_components/status-badge";
import AuditBoard from "./audit-board";
import AuditControls from "./audit-controls";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();
const TYPE_LABEL = { PRODUCT: "Product audit", PLANT: "Plant room audit", WASTE_LOG: "Waste log audit" } as const;

export default async function AuditPage({ params, searchParams }: PageProps<"/inventory-audit/audits/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) notFound();

  const audit = await db.iaAudit.findUnique({
    where: { id },
    include: { facility: true, defaultDepartment: true, createdBy: { select: { name: true, email: true } }, completedBy: { select: { name: true, email: true } } },
  });
  if (!audit) notFound();

  const stats = await auditStats(id);
  const view = one(sp.view) === "findings" ? "findings" : "count";
  const q = one(sp.q), room = one(sp.room);
  const statusRaw = one(sp.status);
  // Default to what's left to do; once everything is counted, show everything.
  const status = ["pending", "ok", "discrepancy", "all"].includes(statusRaw) ? statusRaw : stats.pending > 0 ? "pending" : "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const canEdit = audit.status === "IN_PROGRESS";

  const qs = (over: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ view: view === "findings" ? "findings" : "", status, room, q, ...over })) if (v) u.set(k, v);
    const s = u.toString();
    return `/inventory-audit/audits/${id}${s ? `?${s}` : ""}`;
  };

  const progress = stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0;

  let body: React.ReactNode;
  if (view === "findings") {
    const findings = await db.iaFinding.findMany({
      where: { auditId: id }, orderBy: [{ createdAt: "desc" }],
      include: { department: true, findingType: true, assignedTo: { select: { name: true, email: true } } },
    });
    body = (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50"><tr>{["Finding", "Type", "Department", "Status", "Due", "Assigned"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {findings.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="max-w-md px-3 py-2"><Link href={`/inventory-audit/findings/${f.id}`} className="font-medium text-gray-900 hover:underline">{f.description.length > 100 ? `${f.description.slice(0, 100)}…` : f.description}</Link></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.findingType.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.department.name}</td>
                <td className="whitespace-nowrap px-3 py-2"><StatusBadge status={f.status} overdue={isOverdue(f)} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(f.dueDate)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "—"}</td>
              </tr>
            ))}
            {findings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No discrepancies documented in this audit.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  } else {
    const where: Prisma.IaAuditLineWhereInput = {
      auditId: id,
      ...(status === "pending" ? { status: "PENDING" } : status === "ok" ? { status: "OK" } : status === "discrepancy" ? { status: "DISCREPANCY" } : {}),
      ...(room ? { room } : {}),
      ...(q ? { OR: [
        { product: { contains: q, mode: "insensitive" } }, { batchId: { contains: q, mode: "insensitive" } }, { pid: { contains: q, mode: "insensitive" } },
        { strain: { contains: q, mode: "insensitive" } }, { serialNo: { contains: q, mode: "insensitive" } },
      ] } : {}),
    };
    const [matching, rows, rooms, categories] = await Promise.all([
      db.iaAuditLine.count({ where }),
      db.iaAuditLine.findMany({
        where, orderBy: { position: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
        include: { countedBy: { select: { name: true, email: true } }, finding: { select: { id: true, status: true } } },
      }),
      db.iaAuditLine.groupBy({ by: ["room"], where: { auditId: id, room: { not: null } }, _count: { _all: true }, orderBy: { room: "asc" } }),
      db.iaFindingCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    ]);
    const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
    const defaultCategoryId = (categories.find((c) => c.name === defaultCategoryName(audit.auditType)) ?? categories[0])?.id ?? "";
    // A scan that finds exactly one line opens it straight away.
    const openId = q && matching === 1 && rows[0]?.status === "PENDING" ? rows[0].id : null;

    body = (
      <>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input
            name="q" defaultValue={q} placeholder="Search or scan batch, PID, tag, serial, product…"
            autoFocus={q !== ""}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base sm:max-w-md"
          />
          {rooms.length > 0 && (
            <select name="room" defaultValue={room} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
              <option value="">All rooms</option>
              {rooms.map((r) => <option key={r.room} value={r.room!}>{r.room} ({r._count._all})</option>)}
            </select>
          )}
          <button className="rounded-lg border border-black bg-black px-4 py-2 text-sm font-medium text-white">Find</button>
          {(q || room) && <Link href={qs({ q: "", room: "" })} className="text-sm text-gray-500 hover:underline">Clear</Link>}
        </form>

        <p className="mt-3 text-xs text-gray-500">
          {matching.toLocaleString("en-US")} line{matching === 1 ? "" : "s"}
          {pages > 1 && ` · page ${page} of ${pages}`}
          {canEdit ? " · tap a line to count it" : " · this audit is complete"}
        </p>

        <div className="mt-2">
          <AuditBoard lines={rows.map(toLineView)} categories={categories} defaultCategoryId={defaultCategoryId} canEdit={canEdit} openId={openId} />
        </div>

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>Page {page} of {pages}</span>
            <span className="flex gap-4">
              {page > 1 && <Link href={qs({ page: String(page - 1) })} className="hover:underline">← Previous</Link>}
              {page < pages && <Link href={qs({ page: String(page + 1) })} className="hover:underline">Next →</Link>}
            </span>
          </div>
        )}
      </>
    );
  }

  const tab = (key: string, label: string, n: number) => (
    <Link key={key} href={qs({ status: key, page: "", view: "" })}
      className={`rounded-full px-3 py-1 text-sm font-medium ${view === "count" && status === key ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
      {label} <span className="tabular-nums opacity-70">{n.toLocaleString("en-US")}</span>
    </Link>
  );

  return (
    <div className="max-w-5xl">
      <BackLink href="/inventory-audit/audits" label="Audits" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{audit.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {audit.facility.name} · {TYPE_LABEL[audit.auditType]} · {formatDate(audit.auditDate)}
            {audit.auditors ? ` · ${audit.auditors}` : ""}
            {audit.defaultDepartment ? ` · findings to ${audit.defaultDepartment.name}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {audit.status === "COMPLETED"
              ? `Completed ${formatDate(audit.completedAt)}${audit.completedBy ? ` by ${audit.completedBy.name || audit.completedBy.email}` : ""}`
              : "In progress"}
            {audit.sourceFile ? ` · from ${audit.sourceFile}` : ""}
          </p>
        </div>
        <AuditControls auditId={id} status={audit.status} pending={stats.pending} isAdmin={CAN_CONFIGURE.includes(me.role)} exportHref={`/inventory-audit/audits/${id}/export`} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{stats.counted.toLocaleString("en-US")} of {stats.total.toLocaleString("en-US")} counted ({progress}%)</span>
          <span>
            {stats.discrepancy.toLocaleString("en-US")} discrepanc{stats.discrepancy === 1 ? "y" : "ies"}
            {stats.counted > 0 && ` · ${(stats.rate * 100).toFixed(1)}% of counted lines`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#134229]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {tab("pending", "Pending", stats.pending)}
        {tab("discrepancy", "Discrepancies", stats.discrepancy)}
        {tab("ok", "OK", stats.ok)}
        {tab("all", "All", stats.total)}
        <Link href={qs({ view: view === "findings" ? "" : "findings", page: "" })}
          className={`ml-auto rounded-full px-3 py-1 text-sm font-medium ${view === "findings" ? "bg-black text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
          Findings from this audit
        </Link>
      </div>

      <div className="mt-4">{body}</div>
    </div>
  );
}
