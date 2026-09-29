"use client";

import { useActionState, useState } from "react";
import { updateTransfer } from "../../actions";
import TransferLinesEditor, { newLine } from "../../transfer-lines-editor";
import { costKey } from "@/lib/cost-allocation";
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
  const [fromSiteId, setFromSiteId] = useState(transfer.fromSiteId);
  // Saved lines are already priced (one per cost layer), so each opens as a
  // specific-layer choice; switch a line to FIFO to re-price it from stock.
  const [initialLines] = useState(() =>
    transfer.lines.length > 0
      ? transfer.lines.map((l) =>
          newLine({
            itemId: l.itemId,
            quantity: String(l.quantity),
            choice: l.unitCost != null ? costKey(l.unitCost) : "FIFO",
          })
        )
      : [newLine()]
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
            value={fromSiteId}
            onChange={(e) => setFromSiteId(e.target.value)}
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

      <TransferLinesEditor
        items={items}
        fromSiteId={fromSiteId}
        excludeTransferId={transfer.id}
        initialLines={initialLines}
      />

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
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
