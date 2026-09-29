"use client";

import { useActionState, useState } from "react";
import { createTransfer } from "../actions";
import TransferLinesEditor, { newLine } from "../transfer-lines-editor";
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
  const [fromSiteId, setFromSiteId] = useState("");
  const [initialLines] = useState(() => [newLine()]);

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
            value={fromSiteId}
            onChange={(e) => setFromSiteId(e.target.value)}
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

      <TransferLinesEditor items={items} fromSiteId={fromSiteId} initialLines={initialLines} />

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
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create transfer"}
      </button>
    </form>
  );
}
