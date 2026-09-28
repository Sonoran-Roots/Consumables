"use client";

import type { FinanceSiteRow } from "./page";

const COLUMNS: { key: keyof FinanceSiteRow; label: string }[] = [
  { key: "startingValue", label: "Starting" },
  { key: "purchasedValue", label: "Purchased" },
  { key: "producedValue", label: "Produced" },
  { key: "transferInValue", label: "Transfer in" },
  { key: "transferOutValue", label: "Transfer out" },
  { key: "soldValue", label: "Sold" },
  { key: "soldAkValue", label: "Sold (AK)" },
  { key: "usedValue", label: "Used" },
  { key: "endingValue", label: "Ending" },
  { key: "discrepancyValue", label: "Discrepancy" },
];

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function FinanceReportTable({
  rows,
  byMaterialType,
  periodStart,
  periodEnd,
}: {
  rows: FinanceSiteRow[];
  byMaterialType: boolean;
  periodStart: string;
  periodEnd: string;
}) {
  const totals = COLUMNS.reduce(
    (acc, col) => {
      acc[col.key] = rows.reduce((sum, r) => sum + (r[col.key] as number), 0);
      return acc;
    },
    {} as Record<keyof FinanceSiteRow, number>
  );

  function downloadCsv() {
    const header = [
      "Site",
      ...(byMaterialType ? ["Material type"] : []),
      ...COLUMNS.map((c) => c.label),
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.siteName,
          ...(byMaterialType ? [row.materialType ?? ""] : []),
          ...COLUMNS.map((c) => (row[c.key] as number).toFixed(2)),
        ]
          .map(csvCell)
          .join(",")
      );
    }
    lines.push(
      ["TOTAL", ...(byMaterialType ? [""] : []), ...COLUMNS.map((c) => totals[c.key].toFixed(2))]
        .map(csvCell)
        .join(",")
    );
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eom-finance-report_${periodStart}_to_${periodEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {rows.length} row{rows.length === 1 ? "" : "s"} with activity this period.
        </p>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left font-medium text-gray-500">
                Site
              </th>
              {byMaterialType && (
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Material type
                </th>
              )}
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-medium text-gray-500">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={`${row.siteId}-${row.materialType ?? i}`}>
                <td className="sticky left-0 bg-white px-4 py-1.5 font-medium text-gray-900">
                  {row.siteName}
                </td>
                {byMaterialType && (
                  <td className="px-3 py-1.5 text-gray-600">{row.materialType}</td>
                )}
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                    {money(row[c.key] as number)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + (byMaterialType ? 2 : 1)}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  No activity recorded at any site during this period.
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-medium">
                <td className="sticky left-0 bg-gray-50 px-4 py-1.5 text-gray-900">TOTAL</td>
                {byMaterialType && <td className="px-3 py-1.5" />}
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                    {money(totals[c.key])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
