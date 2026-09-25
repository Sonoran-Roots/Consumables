"use client";

import { useActionState } from "react";
import { createReconciliation, createReconciliationForAllSites } from "../actions";
import type { Site, Book } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: isoDate(start), end: isoDate(end) };
}

export default function ReconciliationForm({ sites }: { sites: SiteWithBook[] }) {
  const [state, formAction, pending] = useActionState(createReconciliation, null);
  const period = defaultPeriod();

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">Site *</label>
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
              defaultValue={period.start}
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
              defaultValue={period.end}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Defaults to a rolling 30-day window ending today — change the dates
          for a calendar month-end close instead.
        </p>
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
          {pending ? "Creating…" : "Start reconciliation"}
        </button>
      </form>

      <div className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-medium text-gray-700">
          Close all sites for a period
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Creates one open reconciliation per active site for the same dates
          — for month-end close instead of repeating the form per site.
        </p>
        <form action={createReconciliationForAllSites} className="mt-3 flex items-end gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start</label>
            <input
              name="periodStart"
              type="date"
              required
              defaultValue={period.start}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End</label>
            <input
              name="periodEnd"
              type="date"
              required
              defaultValue={period.end}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Create for all sites
          </button>
        </form>
      </div>
    </div>
  );
}
