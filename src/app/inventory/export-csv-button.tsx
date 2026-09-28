"use client";

type Row = {
  itemName: string;
  siteName: string;
  categoryName: string;
  onHand: number;
  uom: string;
};

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ExportCsvButton({
  rows,
  siteLabel,
}: {
  rows: Row[];
  siteLabel: string;
}) {
  function downloadCsv() {
    const header = ["Item", "Site", "Category", "On hand", "UOM"];
    const lines = [header.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push(
        [row.itemName, row.siteName, row.categoryName, row.onHand, row.uom]
          .map(csvCell)
          .join(",")
      );
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `current-inventory_${siteLabel}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      disabled={rows.length === 0}
      className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
    >
      Download CSV
    </button>
  );
}
