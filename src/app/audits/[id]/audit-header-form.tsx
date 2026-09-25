"use client";

import { useActionState, useState } from "react";
import { updateAuditHeader } from "../actions";
import type { Site, Employee, Book, Audit } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

function dateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AuditHeaderForm({
  audit,
  sites,
  employees,
}: {
  audit: Audit;
  sites: SiteWithBook[];
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(updateAuditHeader, null);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-emerald-700 hover:underline"
      >
        edit site/date/performed by
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      <input type="hidden" name="auditId" value={audit.id} />

      {state?.error && (
        <div className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700">Site</label>
        <select
          name="siteId"
          required
          defaultValue={audit.siteId}
          className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.book.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">Audit date</label>
        <input
          name="auditDate"
          type="date"
          required
          defaultValue={dateInputValue(audit.auditDate)}
          className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">
          Performed by
        </label>
        <select
          name="performedById"
          defaultValue={audit.performedById ?? ""}
          className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
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
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-sm text-gray-500 hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}
