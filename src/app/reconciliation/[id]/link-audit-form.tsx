"use client";

import { useActionState } from "react";
import { linkAudit } from "../actions";
import type { Audit } from "@prisma/client";

export default function LinkAuditForm({
  reconciliationId,
  candidates,
}: {
  reconciliationId: string;
  candidates: Audit[];
}) {
  const [state, formAction, pending] = useActionState(linkAudit, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input type="hidden" name="reconciliationId" value={reconciliationId} />
        <select
          name="auditId"
          required
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Select an existing audit for this site…</option>
          {candidates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.auditDate.toISOString().slice(0, 10)} — {a.status}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
        >
          {pending ? "Linking…" : "Link"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
