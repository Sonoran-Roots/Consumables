"use client";

import { useActionState, type ReactNode } from "react";
import type { BulkResult } from "./csv";

export default function BulkUploadForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: BulkResult, formData: FormData) => Promise<BulkResult>;
  submitLabel: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

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

      {children}

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" name="checkOnly" className="mt-0.5" />
        <span>
          Check only — validate the file and show what would happen, without saving
          anything.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {pending ? "Working…" : submitLabel}
      </button>

      {state && (
        <div className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
          {state.checkOnly && (
            <p className="font-medium text-amber-700">
              Check only — nothing was saved.
            </p>
          )}
          <p className="text-[#134229]">
            {state.checkOnly ? "Would create" : "Created"} {state.created}
            {state.updated > 0 && (
              <>
                , {state.checkOnly ? "would update" : "updated"} {state.updated}
              </>
            )}
            {state.skipped > 0 && <>, skipped {state.skipped}</>}.
          </p>
          {state.notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-gray-600">
              {state.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          {state.errors.length > 0 && (
            <div>
              <p className="text-red-700">
                {state.errors.length} problem{state.errors.length === 1 ? "" : "s"}:
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
