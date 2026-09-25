"use client";

type Site = { id: string; name: string };
type Row = { itemId: string; itemName: string; bySite: Record<string, number>; total: number };

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function UsageReportTable({
  sites,
  rows,
  periodStart,
  periodEnd,
}: {
  sites: Site[];
  rows: Row[];
  periodStart: string;
  periodEnd: string;
}) {
  function downloadCsv() {
    const header = ["Item", ...sites.map((s) => s.name), "Total"];
    const lines = [header.map(csvCell).join(",")];
    for (const row of rows) {
      const cells = [
        row.itemName,
        ...sites.map((s) => row.bySite[s.id] ?? 0),
        row.total,
      ];
      lines.push(cells.map(csvCell).join(","));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-report_${periodStart}_to_${periodEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {rows.length} item{rows.length === 1 ? "" : "s"} with usage in this period.
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
                Item
              </th>
              {sites.map((s) => (
                <th
                  key={s.id}
                  className="px-3 py-2 text-right font-medium text-gray-500"
                >
                  {s.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.itemId}>
                <td className="sticky left-0 bg-white px-4 py-1.5 text-gray-900">
                  {row.itemName}
                </td>
                {sites.map((s) => (
                  <td key={s.id} className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                    {row.bySite[s.id] || "—"}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-medium tabular-nums text-gray-900">
                  {row.total}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={sites.length + 2}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  No usage recorded at any site during this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
