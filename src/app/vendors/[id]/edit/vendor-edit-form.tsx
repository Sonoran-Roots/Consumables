"use client";

import { useActionState } from "react";
import { updateVendor } from "../../actions";
import type { Vendor } from "@prisma/client";

export default function VendorEditForm({ vendor }: { vendor: Vendor }) {
  const [state, formAction, pending] = useActionState(updateVendor, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vendorId" value={vendor.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          name="name"
          required
          defaultValue={vendor.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={vendor.isActive}
          className="rounded border-gray-300"
        />
        Active
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
