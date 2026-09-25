"use client";

import { useActionState, useState } from "react";
import { createCheckout } from "../actions";
import type { Site, Item, Employee } from "@prisma/client";

export default function CheckoutForm({
  sites,
  items,
  employees,
}: {
  sites: Site[];
  items: Item[];
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(createCheckout, null);
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
          <label className="block text-sm font-medium text-gray-700">Site *</label>
          <select
            name="siteId"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Employee *
          </label>
          <select
            name="employeeId"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {employees.length === 0 && (
        <p className="text-sm text-amber-700">
          No employees yet — add one on the Employees page first.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Purpose</label>
          <input
            name="purpose"
            placeholder="e.g. restocking display case"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Department
          </label>
          <input
            name="department"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="isReturn" className="rounded border-gray-300" />
        This is a return of previously checked-out items
      </label>

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
            <div key={i} className="grid grid-cols-[1fr_100px] gap-2">
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
        {pending ? "Saving…" : "Save checkout"}
      </button>
    </form>
  );
}
