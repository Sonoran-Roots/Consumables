"use client";

import { useActionState, useState } from "react";
import { updateTransfer } from "../../actions";
import type { Site, Item, Employee, Book, Transfer, TransferLine } from "@prisma/client";

type SiteWithBook = Site & { book: Book };
type TransferWithLines = Transfer & { lines: TransferLine[] };

export default function TransferEditForm({
  transfer,
  sites,
  items,
  employees,
}: {
  transfer: TransferWithLines;
  sites: SiteWithBook[];
  items: Item[];
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(updateTransfer, null);
  const [lines, setLines] = useState(
    transfer.lines.length > 0
      ? transfer.lines.map((l) => ({
          itemId: l.itemId,
          quantity: String(l.quantity),
          unitCost: l.unitCost != null ? String(l.unitCost) : "",
        }))
      : [{ itemId: "", quantity: "", unitCost: "" }]
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="transferId" value={transfer.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            From site *
          </label>
          <select
            name="fromSiteId"
            required
            defaultValue={transfer.fromSiteId}
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
          <label className="block text-sm font-medium text-gray-700">To site *</label>
          <select
            name="toSiteId"
            required
            defaultValue={transfer.toSiteId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.book.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Requested by
          </label>
          <select
            name="requestedById"
            defaultValue={transfer.requestedById ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Unspecified</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Received by
          </label>
          <select
            name="receivedById"
            defaultValue={transfer.receivedById ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Unspecified</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Items *</label>
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [...prev, { itemId: "", quantity: "", unitCost: "" }])
            }
            className="text-sm text-emerald-700 hover:underline"
          >
            + Add line
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] gap-2">
              <select
                name="itemId"
                defaultValue={line.itemId}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">Select item…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                name="quantity"
                type="number"
                step="any"
                min="0"
                placeholder="Qty"
                defaultValue={line.quantity}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
              <input
                name="unitCost"
                type="number"
                step="any"
                min="0"
                placeholder="Unit cost"
                defaultValue={line.unitCost}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-gray-400 hover:text-red-600"
              >
                remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={transfer.notes ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

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
