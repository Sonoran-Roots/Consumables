"use client";

import { useActionState, useState } from "react";
import { createPurchaseOrder } from "../actions";
import type { Site, Vendor, Item, Book } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

function todayLocalDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

type Line = { itemId: string; quantityOrdered: string; unitCost: string };

export default function PurchaseOrderForm({
  sites,
  vendors,
  items,
}: {
  sites: SiteWithBook[];
  vendors: Vendor[];
  items: Item[];
}) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, null);
  const [lines, setLines] = useState<Line[]>([
    { itemId: "", quantityOrdered: "", unitCost: "" },
  ]);

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
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.book.code})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            The whole PO is received here, even across partial deliveries.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Vendor *</label>
          <select
            name="vendorId"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
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
          defaultValue={todayLocalDateString()}
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
                { itemId: "", quantityOrdered: "", unitCost: "" },
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
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create PO"}
      </button>
    </form>
  );
}
