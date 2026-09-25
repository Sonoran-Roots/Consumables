import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import {
  recordDelivery,
  recordPayment,
  markPaidInFull,
  closePurchaseOrder,
  addVendorCredit,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-800",
  FULLY_RECEIVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-gray-100 text-gray-500",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default async function PurchaseOrderDetailPage({
  params,
}: PageProps<"/purchasing/[id]">) {
  const { id } = await params;

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      site: true,
      vendor: true,
      lines: {
        include: { item: true, inventoryTransactions: true },
      },
      payments: { orderBy: { paymentDate: "desc" } },
      vendorCredits: { orderBy: { creditDate: "desc" } },
    },
  });
  if (!po) notFound();

  const isClosed = po.status === "CLOSED";
  const totalPaid = po.payments.reduce((sum, p) => sum + p.amount, 0);

  const lineRows = po.lines.map((line) => {
    const received = line.inventoryTransactions.reduce((s, t) => s + t.quantity, 0);
    return {
      ...line,
      received,
      remaining: Math.max(line.quantityOrdered - received, 0),
      lineTotal: line.quantityOrdered * line.unitCost,
    };
  });
  const poTotal = lineRows.reduce((sum, l) => sum + l.lineTotal, 0);
  const linesWithRemaining = lineRows.filter((l) => l.remaining > 0);

  const deliveries = po.lines
    .flatMap((line) =>
      line.inventoryTransactions.map((t) => ({
        date: t.occurredAt,
        itemName: line.item.name,
        quantity: t.quantity,
        unitCost: t.unitCost,
      }))
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/purchasing" label="Back to purchase orders" />
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">PO {po.poNumber}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[po.status]}`}
          >
            {po.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {po.vendor.name} · {po.site.name} · ordered {fmtDate(po.orderDate)}
        </p>
        {po.notes && <p className="mt-1 text-sm text-gray-500">{po.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">PO total</div>
          <div className="text-lg font-semibold text-gray-900">
            ${poTotal.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Line items</div>
          <div className="text-lg font-semibold text-gray-900">{po.lines.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Paid</div>
          <div className="text-lg font-semibold text-gray-900">
            ${totalPaid.toFixed(2)}
            {po.paidInFull && (
              <span className="ml-1 text-xs font-normal text-emerald-700">
                (paid in full)
              </span>
            )}
          </div>
        </div>
      </div>

      {!isClosed && (
        <div className="flex gap-2">
          {!po.paidInFull && (
            <form action={markPaidInFull}>
              <input type="hidden" name="purchaseOrderId" value={po.id} />
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Mark paid in full
              </button>
            </form>
          )}
          <form action={closePurchaseOrder}>
            <input type="hidden" name="purchaseOrderId" value={po.id} />
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Close PO
            </button>
          </form>
        </div>
      )}

      {/* Line items — the invoice itself */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Line items</h2>
        <table className="mt-3 min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              <th className="py-1.5 text-left font-medium text-gray-500">Item</th>
              <th className="py-1.5 text-right font-medium text-gray-500">Ordered</th>
              <th className="py-1.5 text-right font-medium text-gray-500">
                Unit cost
              </th>
              <th className="py-1.5 text-right font-medium text-gray-500">Total</th>
              <th className="py-1.5 text-right font-medium text-gray-500">Received</th>
              <th className="py-1.5 text-right font-medium text-gray-500">
                Remaining
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineRows.map((line) => (
              <tr key={line.id}>
                <td className="py-1.5 text-gray-900">{line.item.name}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {line.quantityOrdered}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-500">
                  ${line.unitCost.toFixed(2)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-500">
                  ${line.lineTotal.toFixed(2)}
                </td>
                <td className="py-1.5 text-right tabular-nums">{line.received}</td>
                <td
                  className={`py-1.5 text-right tabular-nums ${
                    line.remaining > 0 ? "font-medium text-amber-700" : "text-gray-400"
                  }`}
                >
                  {line.remaining}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Record a delivery — the only action that moves inventory, per line, per date */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Record a delivery</h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter what actually arrived on a given day. Each quantity posts a
          Purchase transaction at {po.site.name} immediately — leave a line
          blank if nothing for that item arrived in this delivery.
        </p>

        {!isClosed && linesWithRemaining.length > 0 ? (
          <form action={recordDelivery} className="mt-3 space-y-3">
            <input type="hidden" name="purchaseOrderId" value={po.id} />
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Delivery date
              </label>
              <input
                name="receivedDate"
                type="date"
                required
                className="mt-1 w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>

            <div className="space-y-2">
              {linesWithRemaining.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_120px] items-center gap-2"
                >
                  <span className="text-sm text-gray-700">
                    {line.item.name}{" "}
                    <span className="text-xs text-gray-400">
                      ({line.remaining} remaining)
                    </span>
                  </span>
                  <input
                    name={`qty-${line.id}`}
                    type="number"
                    step="any"
                    min="0"
                    max={line.remaining}
                    placeholder="Qty received"
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Record delivery
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-gray-400">
            {isClosed
              ? "This PO is closed."
              : "Every line has been fully received."}
          </p>
        )}

        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-medium text-gray-500">Delivery history</h3>
          <table className="mt-2 min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="py-1.5 text-left font-medium text-gray-500">Date</th>
                <th className="py-1.5 text-left font-medium text-gray-500">Item</th>
                <th className="py-1.5 text-right font-medium text-gray-500">
                  Qty received
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deliveries.map((d, i) => (
                <tr key={i}>
                  <td className="py-1.5 text-gray-900">{fmtDate(d.date)}</td>
                  <td className="py-1.5 text-gray-600">{d.itemName}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.quantity}</td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-gray-400">
                    No deliveries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payments */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Payments</h2>
        {!isClosed && (
          <form action={recordPayment} className="mt-3 flex gap-2">
            <input type="hidden" name="purchaseOrderId" value={po.id} />
            <input
              name="paymentDate"
              type="date"
              required
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              name="amount"
              type="number"
              step="any"
              min="0"
              placeholder="Amount ($)"
              required
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Log
            </button>
          </form>
        )}
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {po.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="text-gray-900">{fmtDate(p.paymentDate)}</span>
              <span className="text-gray-600">${p.amount.toFixed(2)}</span>
            </li>
          ))}
          {po.payments.length === 0 && (
            <li className="py-2 text-gray-400">No payments logged yet.</li>
          )}
        </ul>
      </section>

      {/* Vendor credits */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Vendor credits</h2>
        <form action={addVendorCredit} className="mt-3 space-y-2">
          <input type="hidden" name="purchaseOrderId" value={po.id} />
          <input type="hidden" name="vendorId" value={po.vendorId} />
          <div className="flex gap-2">
            <input
              name="creditDate"
              type="date"
              required
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              name="amount"
              type="number"
              step="any"
              min="0"
              placeholder="Credit amount ($)"
              required
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <input
            name="notes"
            placeholder="Notes"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="accountingNotified"
              className="rounded border-gray-300"
            />
            Accounting notified
          </label>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Log credit
          </button>
        </form>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {po.vendorCredits.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-gray-900">{fmtDate(c.creditDate)}</span>
              <span className="text-gray-600">${c.amount.toFixed(2)}</span>
              <span
                className={
                  c.accountingNotified ? "text-emerald-700" : "text-amber-700"
                }
              >
                {c.accountingNotified ? "Accounting notified" : "Not yet notified"}
              </span>
            </li>
          ))}
          {po.vendorCredits.length === 0 && (
            <li className="py-2 text-gray-400">No vendor credits yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
