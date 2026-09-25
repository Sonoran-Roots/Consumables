"use client";

import { useActionState } from "react";
import { updateReconciliationHeader } from "../../actions";
import type { Site, Book, InventoryReconciliation } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ReconciliationEditForm({
  reconciliation,
  sites,
}: {
  reconciliation: InventoryReconciliation;
  sites: SiteWithBook[];
}) {
  const [state, formAction, pending] = useActionState(updateReconciliationHeader, null);
  const isClosed = reconciliation.status === "CLOSED";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reconciliationId" value={reconciliation.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {isClosed && (
        <p className="text-xs text-amber-700">
          Site and period are ignored while closed — only notes will be
          saved. Reopen first to actually change them.
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">Site *</label>
        <select
          name="siteId"
          required
          defaultValue={reconciliation.siteId}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.book.code})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Period start *
          </label>
          <input
            name="periodStart"
            type="date"
            required
            defaultValue={isoDate(reconciliation.periodStart)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Period end *
          </label>
          <input
            name="periodEnd"
            type="date"
            required
            defaultValue={isoDate(reconciliation.periodEnd)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={reconciliation.notes ?? ""}
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
