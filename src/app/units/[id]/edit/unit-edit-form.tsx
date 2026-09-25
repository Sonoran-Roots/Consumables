"use client";

import { useActionState } from "react";
import { updateUnit } from "../../actions";
import type { UnitOfMeasure } from "@prisma/client";

export default function UnitEditForm({ unit }: { unit: UnitOfMeasure }) {
  const [state, formAction, pending] = useActionState(updateUnit, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unitId" value={unit.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">Code *</label>
        <input
          name="code"
          required
          defaultValue={unit.code}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description (optional)
        </label>
        <input
          name="description"
          defaultValue={unit.description ?? ""}
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
