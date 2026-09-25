"use client";

import { useActionState, useState } from "react";
import { updateCheckout } from "../../actions";
import type { Site, Item, Employee, CheckoutEvent, CheckoutLine } from "@prisma/client";

type CheckoutWithLines = CheckoutEvent & { lines: CheckoutLine[] };

export default function CheckoutEditForm({
  checkout,
  sites,
  items,
  employees,
}: {
  checkout: CheckoutWithLines;
  sites: Site[];
  items: Item[];
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(updateCheckout, null);
  const [lines, setLines] = useState(
    checkout.lines.length > 0
      ? checkout.lines.map((l) => ({ itemId: l.itemId, quantity: String(l.quantity) }))
      : [{ itemId: "", quantity: "" }]
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="checkoutId" value={checkout.id} />

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
            defaultValue={checkout.siteId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
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
            defaultValue={checkout.employeeId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Purpose</label>
          <input
            name="purpose"
            defaultValue={checkout.purpose ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Department
          </label>
          <input
            name="department"
            defaultValue={checkout.department ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isReturn"
          defaultChecked={checkout.isReturn}
          className="rounded border-gray-300"
        />
        This is a return of previously checked-out items
      </label>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Items *</label>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { itemId: "", quantity: "" }])}
            className="text-sm text-emerald-700 hover:underline"
          >
            + Add line
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_auto] gap-2">
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
          defaultValue={checkout.notes ?? ""}
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
