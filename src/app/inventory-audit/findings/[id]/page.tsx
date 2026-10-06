import Link from "next/link";
import { notFound } from "next/navigation";
import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import { getAuditSession } from "@/lib/ia/auth";
import { canSeeFinding } from "@/lib/ia/scope";
import { getFormOptions } from "@/lib/ia/options";
import { formatDate } from "@/lib/ia/dates";
import { availableActions, CAN_ENTER_FINDINGS, daysOverdue, isOverdue, STATUS_LABEL } from "@/lib/ia/workflow";
import StatusBadge from "../../_components/status-badge";
import FindingActions from "../../_components/finding-actions";

export const dynamic = "force-dynamic";

const AUDIT_TYPE_LABEL = { PRODUCT: "Product audit", WASTE_LOG: "Waste log audit", PLANT: "Plant room audit" } as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export default async function FindingPage({ params }: PageProps<"/inventory-audit/findings/[id]">) {
  const { id } = await params;
  const [f, opts, me] = await Promise.all([
    db.iaFinding.findUnique({
      where: { id },
      include: {
        facility: true, department: true, secondDepartment: true, findingType: true, category: true, audit: { select: { id: true, name: true } },
        assignedTo: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true, email: true } },
        verifiedBy: { select: { name: true, email: true } },
        events: { orderBy: { at: "desc" }, include: { actor: { select: { name: true, email: true } } } },
      },
    }),
    getFormOptions(),
    getAuditSession(),
  ]);
  // Not found rather than forbidden: a manager shouldn't learn a finding exists if it isn't theirs.
  if (!f || !me || !(await canSeeFinding(me, id))) notFound();

  const role = me.role;
  const actions = availableActions(f.status, role);
  const canEdit = role !== null && CAN_ENTER_FINDINGS.includes(role);
  const person = (u: { name: string; email: string } | null) => (u ? u.name || u.email : null);

  return (
    <div className="max-w-4xl">
      <BackLink href="/inventory-audit/findings" label="Findings" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={f.status} overdue={isOverdue(f)} />
            <span className="text-sm text-gray-500">{f.findingType.name} · {AUDIT_TYPE_LABEL[f.auditType]}</span>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-gray-900">{f.description}</h1>
        </div>
        {canEdit && (
          <Link href={`/inventory-audit/edit/${f.id}`} className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Edit
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <dl className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
            <Field label="Category" value={f.category?.name} />
            <Field label="From audit" value={f.audit ? (me.role === "MANAGER" ? f.audit.name : <Link href={`/inventory-audit/audits/${f.audit.id}`} className="underline">{f.audit.name}</Link>) : null} />
            <Field label="Facility" value={f.facility.name} />
            <Field label="Date audited" value={formatDate(f.auditDate)} />
            <Field label="Department" value={f.department.name} />
            <Field label="Second department" value={f.secondDepartment?.name} />
            <Field label="Auditors" value={f.auditors} />
            <Field label="Due" value={f.dueDate ? <>{formatDate(f.dueDate)}{isOverdue(f) && <span className="ml-2 font-medium text-red-700">{daysOverdue(f)} day{daysOverdue(f) === 1 ? "" : "s"} overdue</span>}</> : null} />
            <Field label="Product" value={f.product} />
            <Field label="Batch ID" value={f.batchId} />
            <Field label="PID" value={f.pid} />
            <Field label="Strain" value={f.strain} />
            <Field label="Quantity" value={f.quantity != null ? `${f.quantity}${f.unit ? ` ${f.unit}` : ""}` : null} />
            <Field label="Room" value={f.room} />
            <Field label="Serial no." value={f.serialNo} />
            <Field label="Waste log reference" value={f.reference} />
            <Field label="Weight disposed" value={f.weightGrams != null ? `${f.weightGrams} g` : null} />
            <Field label="Physical disposal" value={f.disposalDate ? formatDate(f.disposalDate) : null} />
            <Field label="Correction" value={f.correction} />
            <Field label="Monitoring notes" value={f.monitoringNotes} />
            <Field label="Assigned to" value={person(f.assignedTo)} />
            <Field label="Notified" value={f.notifiedAt ? formatDate(f.notifiedAt) : null} />
            <Field label="Resolved" value={f.resolvedAt ? `${formatDate(f.resolvedAt)}${f.resolvedBy ? ` by ${person(f.resolvedBy)}` : ""}` : null} />
            <Field label="Resolution" value={f.resolutionNotes} />
            <Field label="Verified" value={f.verifiedAt ? `${formatDate(f.verifiedAt)}${f.verifiedBy ? ` by ${person(f.verifiedBy)}` : ""}` : null} />
          </dl>

          <div>
            <h2 className="text-sm font-medium text-gray-700">History</h2>
            <ol className="mt-2 space-y-2">
              {f.events.map((e) => (
                <li key={e.id} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">
                  <p className="text-gray-900">
                    {e.kind === "STATUS" && e.toStatus && <strong className="font-medium">{e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ""}{STATUS_LABEL[e.toStatus]}</strong>}
                    {e.kind === "CREATED" && <strong className="font-medium">Logged</strong>}
                    {e.kind === "EDITED" && <strong className="font-medium">Edited</strong>}
                    {e.kind === "ASSIGNED" && <strong className="font-medium">Assignment</strong>}
                    {e.kind === "NOTE" && <strong className="font-medium">Note</strong>}
                    {e.kind === "REMINDED" && <strong className="font-medium">Reminder sent</strong>}
                    <span className="text-gray-500"> · {person(e.actor) ?? "someone"} · {e.at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </p>
                  {e.note && <p className="mt-0.5 whitespace-pre-wrap text-gray-600">{e.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 lg:self-start">
          <h2 className="text-sm font-medium text-gray-700">Follow-up</h2>
          <div className="mt-3">
            <FindingActions
              findingId={f.id}
              actions={actions}
              canAssign={canEdit}
              assigneeId={f.assignedToId ?? ""}
              assignees={opts.assignees}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
