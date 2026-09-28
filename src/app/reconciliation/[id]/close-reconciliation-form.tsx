"use client";

import { useActionState } from "react";
import { closeReconciliation } from "../actions";
import type { Employee } from "@prisma/client";

export default function CloseReconciliationForm({
  reconciliationId,
  employees,
}: {
  reconciliationId: string;
  employees: Employee[];
}) {
  const [state, formAction, pending] = useActionState(closeReconciliation, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input type="hidden" name="reconciliationId" value={reconciliationId} />
        <select
          name="closedById"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Closed by…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
        >
          {pending ? "Closing…" : "Close period"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
