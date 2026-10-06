import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { formatDate } from "@/lib/ia/dates";

export const dynamic = "force-dynamic";
const TYPE_LABEL = { PRODUCT: "Product", PLANT: "Plant room", WASTE_LOG: "Waste log" } as const;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export default async function AuditsPage({ searchParams }: PageProps<"/inventory-audit/audits">) {
  const sp = await searchParams;
  const show = ["progress", "done", "all"].includes(one(sp.show)) ? one(sp.show) : "progress";
  const where: Prisma.IaAuditWhereInput = show === "progress" ? { status: "IN_PROGRESS" } : show === "done" ? { status: "COMPLETED" } : {};

  const audits = await db.iaAudit.findMany({
    where, orderBy: [{ auditDate: "desc" }, { createdAt: "desc" }], take: 200,
    include: { facility: true },
  });
  const grouped = audits.length
    ? await db.iaAuditLine.groupBy({ by: ["auditId", "status"], where: { auditId: { in: audits.map((a) => a.id) } }, _count: { _all: true } })
    : [];
  const stat = (auditId: string) => {
    const n = (s: string) => grouped.find((g) => g.auditId === auditId && g.status === s)?._count._all ?? 0;
    const pending = n("PENDING"), ok = n("OK"), disc = n("DISCREPANCY");
    return { total: pending + ok + disc, counted: ok + disc, disc };
  };
  const tab = (key: string, label: string) => (
    <Link key={key} href={`/inventory-audit/audits?show=${key}`}
      className={`rounded-full px-3 py-1 text-sm font-medium ${show === key ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{label}</Link>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Audits</h1>
          <p className="mt-1 text-sm text-gray-500">Upload the lines to audit, count them, and document discrepancies as you find them.</p>
        </div>
        <Link href="/inventory-audit/audits/new" className="shrink-0 whitespace-nowrap rounded-md border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:bg-white hover:text-black">
          Start an audit
        </Link>
      </div>

      <div className="mt-4 flex gap-2">{tab("progress", "In progress")}{tab("done", "Completed")}{tab("all", "All")}</div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>{["Audit", "Facility", "Type", "Date", "Progress", "Discrepancies", "Status"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {audits.map((a) => {
              const s = stat(a.id);
              const pct = s.total ? Math.round((s.counted / s.total) * 100) : 0;
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><Link href={`/inventory-audit/audits/${a.id}`} className="font-medium text-gray-900 hover:underline">{a.name}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{a.facility.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{TYPE_LABEL[a.auditType]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(a.auditDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                    <span className="tabular-nums">{s.counted.toLocaleString("en-US")} / {s.total.toLocaleString("en-US")}</span>{" "}
                    <span className="text-xs text-gray-400">({pct}%)</span>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${s.disc ? "font-medium text-red-700" : "text-gray-400"}`}>{s.disc || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "COMPLETED" ? "bg-[#e5f3e5] text-[#0e3020]" : "bg-amber-50 text-amber-800"}`}>
                      {a.status === "COMPLETED" ? "Completed" : "In progress"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {audits.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No audits here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
