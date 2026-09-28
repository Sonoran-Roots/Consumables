import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import { computeReconciliationLines, computeInterBookTransfers } from "@/lib/reconciliation-compute";
import FinanceReportTable from "./finance-report-table";
import InterBookTable from "./inter-book-table";
import type { MaterialType } from "@prisma/client";

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
  materialType?: MaterialType;
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

function emptyRow(siteId: string, siteName: string, materialType?: MaterialType): FinanceSiteRow {
  return {
    siteId,
    siteName,
    materialType,
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
}

function addLine(row: FinanceSiteRow, l: Awaited<ReturnType<typeof computeReconciliationLines>>[number]) {
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

function isRowEmpty(r: FinanceSiteRow) {
  return (
    r.startingValue === 0 &&
    r.purchasedValue === 0 &&
    r.producedValue === 0 &&
    r.transferInValue === 0 &&
    r.transferOutValue === 0 &&
    r.soldValue === 0 &&
    r.soldAkValue === 0 &&
    r.usedValue === 0 &&
    r.endingValue === 0 &&
    r.discrepancyValue === 0
  );
}

export default async function FinanceReportPage({
  searchParams,
}: PageProps<"/reconciliation/finance-report">) {
  const params = await searchParams;
  const defaults = defaultPeriod();
  const periodStartRaw = paramValue(params.periodStart) || defaults.start;
  const periodEndRaw = paramValue(params.periodEnd) || defaults.end;
  const byMaterialType = paramValue(params.byMaterialType) === "on";

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
  let interBook: Awaited<ReturnType<typeof computeInterBookTransfers>> = [];

  if (validRange) {
    const [perSite] = await Promise.all([
      Promise.all(
        sites.map(async (site) => {
          const lines = await computeReconciliationLines(site.id, periodStart, periodEnd);

          if (!byMaterialType) {
            const row = emptyRow(site.id, site.name);
            for (const l of lines) addLine(row, l);
            return [row];
          }

          const byType = new Map<MaterialType, FinanceSiteRow>();
          for (const l of lines) {
            let row = byType.get(l.materialType);
            if (!row) {
              row = emptyRow(site.id, site.name, l.materialType);
              byType.set(l.materialType, row);
            }
            addLine(row, l);
          }
          return [...byType.values()];
        })
      ),
      (async () => {
        interBook = await computeInterBookTransfers(periodStart, periodEnd);
      })(),
    ]);

    rows = perSite.flat().filter((r) => !isRowEmpty(r));
    if (byMaterialType) {
      rows.sort((a, b) => a.siteName.localeCompare(b.siteName) || a.materialType!.localeCompare(b.materialType!));
    }
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

      <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
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
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="byMaterialType"
            defaultChecked={byMaterialType}
            className="rounded border-gray-300"
          />
          Break out by material type
        </label>
        <button
          type="submit"
          className="rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black"
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
        <>
          <FinanceReportTable
            rows={rows}
            byMaterialType={byMaterialType}
            periodStart={periodStartRaw}
            periodEnd={periodEndRaw}
          />

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-gray-900">
              Inter-book transfers (who owes whom)
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Any transfer between sites in different books is a movement of
              value between books — the receiving book owes the sending book
              for what it received, at the transfer&apos;s recorded cost.
            </p>
            <InterBookTable
              pairs={interBook}
              periodStart={periodStartRaw}
              periodEnd={periodEndRaw}
            />
          </section>
        </>
      )}
    </div>
  );
}
