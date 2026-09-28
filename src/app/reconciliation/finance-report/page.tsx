import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import { computeReconciliationLines } from "@/lib/reconciliation-compute";
import FinanceReportTable from "./finance-report-table";

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

export type FinanceSiteRow = {
  siteId: string;
  siteName: string;
  startingValue: number;
  purchasedValue: number;
  producedValue: number;
  transferInValue: number;
  transferOutValue: number;
  soldValue: number;
  soldAkValue: number;
  usedValue: number;
  endingValue: number;
  discrepancyValue: number;
};

export default async function FinanceReportPage({
  searchParams,
}: PageProps<"/reconciliation/finance-report">) {
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

  let rows: FinanceSiteRow[] = [];

  if (validRange) {
    const perSite = await Promise.all(
      sites.map(async (site) => {
        const lines = await computeReconciliationLines(site.id, periodStart, periodEnd);
        const row: FinanceSiteRow = {
          siteId: site.id,
          siteName: site.name,
          startingValue: 0,
          purchasedValue: 0,
          producedValue: 0,
          transferInValue: 0,
          transferOutValue: 0,
          soldValue: 0,
          soldAkValue: 0,
          usedValue: 0,
          endingValue: 0,
          discrepancyValue: 0,
        };
        for (const l of lines) {
          row.startingValue += l.beginningValue ?? 0;
          row.purchasedValue += l.purchasedValue;
          row.producedValue += l.producedValue;
          row.transferInValue += l.transferInValue;
          row.transferOutValue += l.transferOutValue;
          row.soldValue += l.soldValue;
          row.soldAkValue += l.soldAkValue;
          row.usedValue += l.usedValue;
          row.endingValue += l.endingValue ?? 0;
          row.discrepancyValue += l.discrepancyValue;
        }
        return row;
      })
    );
    // Only sites with something to report — an all-zero row is just noise
    // for a monthly finance handoff.
    rows = perSite.filter(
      (r) =>
        r.startingValue !== 0 ||
        r.purchasedValue !== 0 ||
        r.producedValue !== 0 ||
        r.transferInValue !== 0 ||
        r.transferOutValue !== 0 ||
        r.soldValue !== 0 ||
        r.soldAkValue !== 0 ||
        r.usedValue !== 0 ||
        r.endingValue !== 0 ||
        r.discrepancyValue !== 0
    );
  }

  return (
    <div>
      <BackLink href="/reconciliation" label="Back to reconciliation" />
      <h1 className="text-xl font-semibold text-gray-900">EOM finance report</h1>
      <p className="mt-1 text-sm text-gray-500">
        Per-site starting/purchased/produced/transfers/sold/used/ending
        values for updating accounting software each period — computed live
        from the ledger for the dates below.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Purchased and transfer values use the actual recorded cost at the
        time of each transaction. Starting, produced, sold, used, and ending
        values are estimated using each item&apos;s most recently known
        cost, since checkouts/sales/discrepancies don&apos;t currently
        record a cost of their own — treat those as estimates, not
        recorded actuals.
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
        <FinanceReportTable rows={rows} periodStart={periodStartRaw} periodEnd={periodEndRaw} />
      )}
    </div>
  );
}
