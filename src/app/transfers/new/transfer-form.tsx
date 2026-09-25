"use client";

import { useActionState, useState } from "react";
import { createTransfer } from "../actions";
import type { Site, Item, Employee, Book } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

export default function TransferForm({
  sites,
  items,
  employees,
}: {
  sites: SiteWithBook[];
  items: Item[];
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(createTransfer, null);
  const [lineCount, setLineCount] = useState(1);

  return (
    <form action={formAction} className="space-y-5">
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
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
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
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.book.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Requested by
        </label>
        <select
          name="requestedById"
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
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Items *</label>
          <button
            type="button"
            onClick={() => setLineCount((n) => n + 1)}
            className="text-sm text-emerald-700 hover:underline"
          >
            + Add line
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px] gap-2">
              <select
                name="itemId"
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
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
              <input
                name="unitCost"
                type="number"
                step="any"
                min="0"
                placeholder="Unit cost"
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
            </div>
          ))}
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
        {pending ? "Creating…" : "Create transfer"}
      </button>
    </form>
  );
}
