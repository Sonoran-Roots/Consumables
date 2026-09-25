"use client";

import { useActionState } from "react";
import { updateSite } from "../../actions";
import type { Site, Book } from "@prisma/client";

export default function SiteEditForm({
  site,
  books,
}: {
  site: Site;
  books: Book[];
}) {
  const [state, formAction, pending] = useActionState(updateSite, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="siteId" value={site.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Book *</label>
        <select
          name="bookId"
          required
          defaultValue={site.bookId}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          name="name"
          required
          defaultValue={site.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Code * (must be unique)
        </label>
        <input
          name="code"
          required
          defaultValue={site.code}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          name="address"
          defaultValue={site.address ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          name="type"
          defaultValue={site.type}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="FACILITY">Facility (a real physical site)</option>
          <option value="STAGING">Staging (e.g. intake/receiving)</option>
          <option value="VIRTUAL">
            Virtual (e.g. an out-of-state sales channel)
          </option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isStaging"
          defaultChecked={site.isStaging}
          className="rounded border-gray-300"
        />
        Also flag as a staging location
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={site.isActive}
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
