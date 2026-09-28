"use client";

import type { InterBookTransfer } from "@/lib/reconciliation-compute";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type NetPosition = {
  bookId: string;
  bookName: string;
  sent: number;
  received: number;
  net: number;
};

function computeNetPositions(pairs: InterBookTransfer[]): NetPosition[] {
  const map = new Map<string, NetPosition>();
  function entry(bookId: string, bookName: string) {
    let e = map.get(bookId);
    if (!e) {
      e = { bookId, bookName, sent: 0, received: 0, net: 0 };
      map.set(bookId, e);
    }
    return e;
  }
  for (const p of pairs) {
    entry(p.fromBookId, p.fromBookName).sent += p.value;
    entry(p.toBookId, p.toBookName).received += p.value;
  }
  for (const e of map.values()) {
    // Positive net = this book sent more value than it received, so
    // other books collectively owe it money (net receivable).
    e.net = e.sent - e.received;
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export default function InterBookTable({
  pairs,
  periodStart,
  periodEnd,
}: {
  pairs: InterBookTransfer[];
  periodStart: string;
  periodEnd: string;
}) {
  const positions = computeNetPositions(pairs);

  function downloadCsv() {
    const lines = [
      ["From book", "To book", "Qty", "Value"].map(csvCell).join(","),
      ...pairs.map((p) =>
        [p.fromBookName, p.toBookName, p.qty, p.value.toFixed(2)].map(csvCell).join(",")
      ),
      "",
      ["Book", "Sent value", "Received value", "Net position"].map(csvCell).join(","),
      ...positions.map((p) =>
        [p.bookName, p.sent.toFixed(2), p.received.toFixed(2), p.net.toFixed(2)]
          .map(csvCell)
          .join(",")
      ),
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inter-book-transfers_${periodStart}_to_${periodEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={downloadCsv}
          disabled={pairs.length === 0}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">From book</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">To book</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pairs.map((p) => (
              <tr key={`${p.fromBookId}-${p.toBookId}`}>
                <td className="px-4 py-1.5 text-gray-900">{p.fromBookName}</td>
                <td className="px-4 py-1.5 text-gray-900">{p.toBookName}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{p.qty}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">
                  {money(p.value)}
                </td>
              </tr>
            ))}
            {pairs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No transfers moved value between different books this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {positions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700">Net position per book</h3>
          <p className="mt-1 text-xs text-gray-500">
            Positive net = this book sent more value than it received, so
            other books collectively owe it money. Negative = this book owes
            the difference.
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Book</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Sent</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Received</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((p) => (
                  <tr key={p.bookId}>
                    <td className="px-4 py-1.5 font-medium text-gray-900">{p.bookName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                      {money(p.sent)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                      {money(p.received)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                        p.net > 0
                          ? "text-emerald-700"
                          : p.net < 0
                            ? "text-amber-700"
                            : "text-gray-500"
                      }`}
                    >
                      {money(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
