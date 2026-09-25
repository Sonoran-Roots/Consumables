"use client";

import { useActionState } from "react";
import { importInventoryCsv } from "./actions";

export default function ImportForm() {
  const [state, formAction, pending] = useActionState(importInventoryCsv, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">CSV file *</label>
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>

      {state && (
        <div className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
          <p className="text-emerald-700">
            {state.successCount} row{state.successCount === 1 ? "" : "s"} imported
            successfully.
          </p>
          {state.errorCount > 0 && (
            <div>
              <p className="text-red-700">
                {state.errorCount} row{state.errorCount === 1 ? "" : "s"} skipped:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-600">
                {state.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
