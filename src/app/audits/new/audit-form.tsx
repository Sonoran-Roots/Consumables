"use client";

import { useActionState } from "react";
import { createAudit } from "../actions";
import type { Site, Employee, Book } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

function todayLocalDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function AuditForm({
  sites,
  employees,
}: {
  sites: SiteWithBook[];
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(createAudit, null);

  return (
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

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Audit date *
        </label>
        <input
          name="auditDate"
          type="date"
          required
          defaultValue={todayLocalDateString()}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Performed by
        </label>
        <select
          name="performedById"
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start audit"}
      </button>
    </form>
  );
}
