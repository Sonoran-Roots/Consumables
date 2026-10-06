import Link from "next/link";
import { notFound } from "next/navigation";
import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { AUDIT_LINE_INCLUDE, auditStats, toLineView } from "@/lib/ia/audits";
import { formatDate } from "@/lib/ia/dates";
import { CAN_CONFIGURE, CAN_ENTER_FINDINGS, CAN_RUN_AUDITS, isOverdue } from "@/lib/ia/workflow";
import StatusBadge from "../../_components/status-badge";
import AuditBoard from "./audit-board";
import AuditControls from "./audit-controls";
import ScanButton from "./scan-button";
import CountsUpload from "./counts-upload";
import { cultivationLabel, isCultivationType } from "@/lib/ia/cultivation";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

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
  const canRun = CAN_RUN_AUDITS.includes(me.role);
  // Retail audits are run as Dutchie audit tables (an initial table out, a completed one back).
  // Production and distribution audits are counted from the inventory download instead.
  const cultivation = isCultivationType(audit.dutchieType);
  const dutchieTable = !audit.dutchieType || audit.dutchieType === "RETAIL";

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
      where: { auditId: id }, orderBy: [{ foundAt: "asc" }],
      include: { department: true, findingType: true, assignedTo: { select: { name: true, email: true } } },
    });
    body = (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50"><tr>{["Found", "Finding", "Type", "Department", "Status", "Assigned", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {findings.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.foundAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="max-w-md px-3 py-2"><Link href={`/inventory-audit/findings/${f.id}`} className="font-medium text-gray-900 hover:underline">{f.description.length > 100 ? `${f.description.slice(0, 100)}…` : f.description}</Link></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.findingType.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.department.name}</td>
                <td className="whitespace-nowrap px-3 py-2"><StatusBadge status={f.status} overdue={isOverdue(f)} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.assignedTo ? f.assignedTo.name || f.assignedTo.email : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{f.needsReview && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Needs review</span>}</td>
              </tr>
            ))}
            {findings.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No discrepancies documented in this audit.</td></tr>}
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
        { pid: { contains: q, mode: "insensitive" } }, { serialNo: { contains: q, mode: "insensitive" } }, { batchId: { contains: q, mode: "insensitive" } },
        { product: { contains: q, mode: "insensitive" } }, { strain: { contains: q, mode: "insensitive" } },
      ] } : {}),
    };
    const [matching, rows, rooms, exact] = await Promise.all([
      db.iaAuditLine.count({ where }),
      db.iaAuditLine.findMany({ where, orderBy: { position: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: AUDIT_LINE_INCLUDE }),
      db.iaAuditLine.groupBy({ by: ["room"], where: { auditId: id, room: { not: null } }, _count: { _all: true }, orderBy: { room: "asc" } }),
      // A scanned barcode is the Package ID: an exact match opens that item straight away.
      q ? db.iaAuditLine.findMany({ where: { auditId: id, pid: { equals: q, mode: "insensitive" } }, select: { id: true }, take: 2 }) : Promise.resolve([]),
    ]);
    const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
    const openId = exact.length === 1 ? exact[0].id : q && matching === 1 ? rows[0]?.id ?? null : null;
    // Opening a scanned item that sits on another page or under another filter: show it.
    const lines = openId && !rows.some((r) => r.id === openId)
      ? [...(await db.iaAuditLine.findMany({ where: { id: openId }, include: AUDIT_LINE_INCLUDE })), ...rows]
      : rows;

    body = (
      <>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="status" value={q ? "all" : status} />
          <input
            name="q" defaultValue={q} placeholder={cultivation ? "Type a batch, strain or tag" : "Scan the barcode, or type a PID, tag, batch or product"}
            autoFocus={q !== ""}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base sm:max-w-md"
          />
          <button className="rounded-lg border border-black bg-black px-4 py-2 text-sm font-medium text-white">Find</button>
          {canEdit && !cultivation && <ScanButton auditId={id} />}
          {rooms.length > 0 && (
            <select name="room" defaultValue={room} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
              <option value="">All rooms</option>
              {rooms.map((r) => <option key={r.room} value={r.room!}>{r.room} ({r._count._all})</option>)}
            </select>
          )}
          {(q || room) && <Link href={qs({ q: "", room: "" })} className="text-sm text-gray-500 hover:underline">Clear</Link>}
        </form>

        {q && matching === 0 && exact.length === 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Nothing in this audit matches “{q}”. If it&apos;s a real item that wasn&apos;t in the export, add it to the audit list or record it as a finding.
          </p>
        )}

        <p className="mt-3 text-xs text-gray-500">
          {matching.toLocaleString("en-US")} {cultivation ? "batch" : "item"}{matching === 1 ? "" : cultivation ? "es" : "s"}
          {pages > 1 && ` · page ${page} of ${pages}`}
          {canEdit ? " · tap an item to audit it" : " · this audit is complete"}
        </p>

        <div className="mt-2">
          <AuditBoard lines={lines.map(toLineView)} canEdit={canEdit} openId={openId} cultivation={cultivation} />
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
    <Link key={key} href={qs({ status: key, page: "", view: "", q: "" })}
      className={`rounded-full px-3 py-1 text-sm font-medium ${view === "count" && status === key ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
      {label} <span className="tabular-nums opacity-70">{n.toLocaleString("en-US")}</span>
    </Link>
  );

  return (
    <div className="max-w-5xl">
      <BackLink href={cultivation ? "/inventory-audit/audits?view=cultivation" : "/inventory-audit/audits"} label={cultivation ? "Cultivation audits" : "Audits"} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{audit.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {audit.facility.name}{audit.dutchieType ? ` · ${cultivation ? cultivationLabel(audit.dutchieType) : audit.dutchieType.charAt(0) + audit.dutchieType.slice(1).toLowerCase() + " audit"}` : ""} · {formatDate(audit.auditDate)}
            {audit.auditors ? ` · ${audit.auditors}` : ""}
            {audit.defaultDepartment ? ` · findings to ${audit.defaultDepartment.name}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {audit.status === "COMPLETED"
              ? `Completed ${formatDate(audit.completedAt)}${audit.completedBy ? ` by ${audit.completedBy.name || audit.completedBy.email}` : ""}`
              : "In progress"}
            {audit.createdBy ? ` · started by ${audit.createdBy.name || audit.createdBy.email}` : ""}
            {audit.sourceFile ? ` · from ${audit.sourceFile}` : ""}
          </p>
        </div>
        <AuditControls
          auditId={id} status={audit.status} pending={stats.pending}
          canRun={canRun} canDelete={CAN_CONFIGURE.includes(me.role)}
          exportHref={`/inventory-audit/audits/${id}/export`}
          dutchieExportHref={dutchieTable ? `/inventory-audit/audits/${id}/export?format=dutchie` : null}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{stats.counted.toLocaleString("en-US")} of {stats.total.toLocaleString("en-US")} audited ({progress}%)</span>
          <span>
            {stats.discrepancy.toLocaleString("en-US")} item{stats.discrepancy === 1 ? "" : "s"} with discrepancies
            {stats.counted > 0 && ` · ${(stats.rate * 100).toFixed(1)}%`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#134229]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {canRun && (stats.toReview > 0 || stats.pendingAdjustments > 0 || audit.status === "COMPLETED") && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">After the audit:</span>
          <Link href={`/inventory-audit/review/${id}`} className="font-medium underline">
            Review findings{stats.toReview > 0 ? ` (${stats.toReview} need review)` : ""}
          </Link>
          <Link href={`/inventory-audit/adjustments/${id}`} className="font-medium underline">
            Adjustments report{stats.pendingAdjustments > 0 ? ` (${stats.pendingAdjustments} pending)` : ""}
          </Link>
        </div>
      )}

      {canRun && canEdit && dutchieTable && <div className="mt-4"><CountsUpload auditId={id} /></div>}

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
