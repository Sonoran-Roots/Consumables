"use client";

import { useActionState, useState } from "react";
import { updatePurchaseOrder } from "../../actions";
import type {
  Site,
  Vendor,
  Item,
  Book,
  PurchaseOrder,
  PurchaseOrderLine,
  InventoryTransaction,
} from "@prisma/client";

type SiteWithBook = Site & { book: Book };
type LineWithTx = PurchaseOrderLine & { inventoryTransactions: InventoryTransaction[] };
type POWithLines = PurchaseOrder & { lines: LineWithTx[] };

type Line = {
  lineId: string;
  itemId: string;
  quantityOrdered: string;
  unitCost: string;
  received: number;
};

function dateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function PurchaseOrderEditForm({
  po,
  sites,
  vendors,
  items,
}: {
  po: POWithLines;
  sites: SiteWithBook[];
  vendors: Vendor[];
  items: Item[];
}) {
  const [state, formAction, pending] = useActionState(updatePurchaseOrder, null);
  const [lines, setLines] = useState<Line[]>(
    po.lines.map((l) => ({
      lineId: l.id,
      itemId: l.itemId,
      quantityOrdered: String(l.quantityOrdered),
      unitCost: String(l.unitCost),
      received: l.inventoryTransactions.reduce((s, t) => s + t.quantity, 0),
    }))
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const total = lines.reduce((sum, l) => {
    const qty = Number(l.quantityOrdered);
    const cost = Number(l.unitCost);
    return sum + (Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0);
  }, 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="purchaseOrderId" value={po.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          PO number *
        </label>
        <input
          name="poNumber"
          required
          defaultValue={po.poNumber}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Receiving site *
          </label>
          <select
            name="siteId"
            required
            defaultValue={po.siteId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.book.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Vendor *</label>
          <select
            name="vendorId"
            required
            defaultValue={po.vendorId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Order date *
        </label>
        <input
          name="orderDate"
          type="date"
          required
          defaultValue={dateInputValue(po.orderDate)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Line items *
          </label>
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { lineId: "", itemId: "", quantityOrdered: "", unitCost: "", received: 0 },
              ])
            }
            className="text-sm text-emerald-700 hover:underline"
          >
            + Add line
          </button>
        </div>

        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-[1fr_90px_100px_100px_28px] gap-2 text-xs font-medium text-gray-500">
            <span>Item</span>
            <span>Qty ordered</span>
            <span>Unit cost</span>
            <span>Line total</span>
            <span />
          </div>
          {lines.map((line, i) => {
            const lineTotal =
              Number(line.quantityOrdered) * Number(line.unitCost) || 0;
            return (
              <div key={i} className="grid grid-cols-[1fr_90px_100px_100px_28px] gap-2">
                <input type="hidden" name="lineId" value={line.lineId} />
                <select
                  name="itemId"
                  value={line.itemId}
                  onChange={(e) => updateLine(i, { itemId: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select item…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  name="quantityOrdered"
                  type="number"
                  step="any"
                  min="0"
                  value={line.quantityOrdered}
                  onChange={(e) => updateLine(i, { quantityOrdered: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  name="unitCost"
                  type="number"
                  step="any"
                  min="0"
                  value={line.unitCost}
                  onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <span className="flex items-center text-sm text-gray-600">
                  {lineTotal > 0 ? `$${lineTotal.toFixed(2)}` : "—"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) =>
                      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev
                    )
                  }
                  title="Remove line"
                  className="flex items-center justify-center text-gray-400 hover:text-red-600"
                >
                  ×
                </button>
                {line.received > 0 && (
                  <p className="col-span-5 -mt-1 text-xs text-amber-700">
                    {line.received} already received against this line.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex justify-end text-sm">
          <span className="font-medium text-gray-700">
            PO total: ${total.toFixed(2)}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={po.notes ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="paidInFull"
          defaultChecked={po.paidInFull}
          className="rounded border-gray-300"
        />
        Paid in full
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
