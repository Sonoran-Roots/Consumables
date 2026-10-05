import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAuditSession } from "@/lib/ia/auth";
import { getFormOptions } from "@/lib/ia/options";
import { groupByRecipient } from "@/lib/ia/routing";
import { buildEmail, type EmailFinding, type EmailTemplate } from "@/lib/ia/email";
import { formatDate } from "@/lib/ia/dates";
import { CAN_ENTER_FINDINGS } from "@/lib/ia/workflow";
import EmailCard from "./email-card";

export const dynamic = "force-dynamic";
const LIMIT = 3000;
const select = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

const FALLBACK: EmailTemplate = {
  subject: "Inventory audit findings for your team — {count} to review ({date})",
  intro: "Hi {managerName},\n\nThe inventory audit team found {count} item(s) that need your team's attention. Please review each one and let us know when it is done: {reportLink}\n",
  footer: "Thank you,\n{senderName}\nInventory Audit Team",
};

export default async function EmailPage({ searchParams }: PageProps<"/inventory-audit/email">) {
  const sp = await searchParams;
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) notFound();

  const show = ["new", "open", "overdue"].includes(one(sp.show)) ? one(sp.show) : "new";
  const facilityId = one(sp.facility), departmentId = one(sp.department);
  const now = new Date();

  const status: Prisma.IaFindingWhereInput =
    show === "new" ? { status: "OPEN" }
    : show === "overdue" ? { status: { in: ["OPEN", "NOTIFIED"] }, dueDate: { lt: now } }
    : { status: { in: ["OPEN", "NOTIFIED"] } };
  const where: Prisma.IaFindingWhereInput = {
    AND: [
      status,
      facilityId ? { facilityId } : {},
      departmentId ? { OR: [{ departmentId }, { secondDepartmentId: departmentId }] } : {},
    ],
  };

  const [opts, findings, rules, template] = await Promise.all([
    getFormOptions(),
    db.iaFinding.findMany({
      where, take: LIMIT, orderBy: [{ auditDate: "asc" }],
      include: { facility: true, department: true, secondDepartment: true, findingType: true, category: true },
    }),
    db.iaCoverage.findMany(),
    db.iaEmailTemplate.findUnique({ where: { id: "default" } }),
  ]);

  const { byRecipient, unrouted } = groupByRecipient(findings, rules);
  const people = await db.user.findMany({ where: { id: { in: [...byRecipient.keys()] } }, select: { id: true, name: true, email: true } });
  const personById = new Map(people.map((p) => [p.id, p]));

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const toEmail = (f: (typeof findings)[number]): EmailFinding => ({
    id: f.id, description: f.description, findingTypeName: f.findingType.name, categoryName: f.category?.name ?? null,
    facilityName: f.facility.name, departmentName: f.department.name, secondDepartmentName: f.secondDepartment?.name ?? null,
    auditDate: f.auditDate, dueDate: f.dueDate, status: f.status, product: f.product, batchId: f.batchId, pid: f.pid, strain: f.strain,
    room: f.room, serialNo: f.serialNo, quantity: f.quantity, unit: f.unit, correction: f.correction,
  });

  const cards = [...byRecipient.entries()]
    .map(([userId, list]) => {
      const person = personById.get(userId);
      if (!person) return null;
      const name = person.name || person.email;
      const { subject, body } = buildEmail({
        template: template ?? FALLBACK, recipientName: name, findings: list.map(toEmail), baseUrl, senderName: me.name, now,
      });
      return { userId, name, email: person.email, subject, body, ids: list.map((f) => f.id), openCount: list.filter((f) => f.status === "OPEN").length };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900">Email managers</h1>
      <p className="mt-1 text-sm text-gray-500">
        One drafted email per person, listing the findings routed to them — assigned directly, or matching their
        locations and departments (see <Link href="/inventory-audit/settings" className="underline">Settings</Link>).
        The app doesn&apos;t send anything: copy each email into your own mail, send it, then mark it sent here.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <select name="show" defaultValue={show} className={select} aria-label="Which findings">
          <option value="new">Open findings nobody has been told about yet</option>
          <option value="open">All open and notified findings</option>
          <option value="overdue">Overdue findings only</option>
        </select>
        <select name="facility" defaultValue={facilityId} className={select}>
          <option value="">All facilities</option>
          {opts.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select name="department" defaultValue={departmentId} className={select}>
          <option value="">All departments</option>
          {opts.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black">Draft emails</button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        {findings.length.toLocaleString("en-US")} finding{findings.length === 1 ? "" : "s"} selected · {cards.length} email{cards.length === 1 ? "" : "s"} drafted
        {findings.length >= LIMIT && <span className="text-amber-700"> (limited to the oldest {LIMIT.toLocaleString("en-US")} — narrow the filters)</span>}
      </p>

      {unrouted.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {unrouted.length} finding{unrouted.length === 1 ? " has" : "s have"} no one to send to
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Nobody is assigned and no manager&apos;s coverage matches their facility and department. Add coverage in Settings, or assign them individually.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {unrouted.slice(0, 15).map((f) => (
              <li key={f.id}>
                <Link href={`/inventory-audit/findings/${f.id}`} className="underline">{f.description.length > 70 ? `${f.description.slice(0, 70)}…` : f.description}</Link>
                <span className="text-amber-700"> — {f.facility.name} · {f.department.name} · {formatDate(f.auditDate)}</span>
              </li>
            ))}
            {unrouted.length > 15 && <li className="text-amber-700">…and {unrouted.length - 15} more</li>}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {cards.map((c) => (
          <EmailCard key={c.userId} recipientName={c.name} email={c.email} subject={c.subject} body={c.body} findingIds={c.ids} openCount={c.openCount} />
        ))}
        {cards.length === 0 && unrouted.length === 0 && (
          <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Nothing to send for that selection.
          </p>
        )}
      </div>
    </div>
  );
}
