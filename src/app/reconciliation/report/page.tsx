import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import { computeReconciliationLines } from "@/lib/reconciliation-compute";
import UsageReportTable from "./usage-report-table";

export const dynamic = "force-dynamic";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: isoDate(start), end: isoDate(end) };
}

function paramValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function UsageReportPage({
  searchParams,
}: PageProps<"/reconciliation/report">) {
  const params = await searchParams;
  const defaults = defaultPeriod();
  const periodStartRaw = paramValue(params.periodStart) || defaults.start;
  const periodEndRaw = paramValue(params.periodEnd) || defaults.end;

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  const validRange =
    !Number.isNaN(periodStart.getTime()) &&
    !Number.isNaN(periodEnd.getTime()) &&
    periodEnd > periodStart;

  const sites = await db.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  let itemRows: { itemId: string; itemName: string; bySite: Record<string, number>; total: number }[] =
    [];

  if (validRange) {
    const perSite = await Promise.all(
      sites.map(async (site) => ({
        site,
        lines: await computeReconciliationLines(site.id, periodStart, periodEnd),
      }))
    );

    const itemMap = new Map<string, { bySite: Record<string, number>; total: number }>();
    for (const { site, lines } of perSite) {
      for (const line of lines) {
        if (!line.consumedQty) continue;
        let entry = itemMap.get(line.itemId);
        if (!entry) {
          entry = { bySite: {}, total: 0 };
          itemMap.set(line.itemId, entry);
        }
        entry.bySite[site.id] = line.consumedQty;
        entry.total += line.consumedQty;
      }
    }

    const itemIds = [...itemMap.keys()];
    const items =
      itemIds.length > 0
        ? await db.item.findMany({
            where: { id: { in: itemIds } },
            orderBy: { name: "asc" },
          })
        : [];

    itemRows = items
      .map((item) => {
        const entry = itemMap.get(item.id)!;
        return {
          itemId: item.id,
          itemName: item.name,
          bySite: entry.bySite,
          total: entry.total,
        };
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  return (
    <div>
      <BackLink href="/reconciliation" label="Back to reconciliation" />
      <h1 className="text-xl font-semibold text-gray-900">Usage report</h1>
      <p className="mt-1 text-sm text-gray-500">
        How much of each item was used or missing (sales, net checkouts,
        damage, and audit discrepancies) at each site during the period — for
        export and blending with other production data to work out costs.
      </p>

      <form className="mt-4 flex items-end gap-2" method="get">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start</label>
          <input
            name="periodStart"
            type="date"
            defaultValue={periodStartRaw}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End</label>
          <input
            name="periodEnd"
            type="date"
            defaultValue={periodEndRaw}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Run report
        </button>
      </form>

      {!validRange && (
        <p className="mt-4 text-sm text-red-700">
          Invalid period — end must be after start.
        </p>
      )}

      {validRange && (
        <UsageReportTable
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          rows={itemRows}
          periodStart={periodStartRaw}
          periodEnd={periodEndRaw}
        />
      )}
    </div>
  );
}
