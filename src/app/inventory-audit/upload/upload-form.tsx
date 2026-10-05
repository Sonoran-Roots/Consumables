"use client";

import { useActionState } from "react";
import { uploadFindingsCsv } from "./actions";

export default function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadFindingsCsv, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Audit type *</label>
          <select name="auditType" defaultValue="PRODUCT" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="PRODUCT">Product audit</option>
            <option value="WASTE_LOG">Waste log audit</option>
            <option value="PLANT">Plant room audit</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">CSV file *</label>
          <input
            name="file" type="file" accept=".csv,text/csv" required
            className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          When a row says Resolution Confirmed (and the file has no Verified By Inventory column)
        </label>
        <select name="confirmedMeans" defaultValue="VERIFIED" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="VERIFIED">Treat it as verified — close the finding (best for loading history)</option>
          <option value="RESOLVED">Treat it as resolved — inventory still has to verify</option>
        </select>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" name="checkOnly" className="mt-0.5" />
        <span>Check only — validate the file and show what would happen, without saving anything.</span>
      </label>

      <button type="submit" disabled={pending}
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50">
        {pending ? "Working…" : "Upload findings"}
      </button>

      {state && (
        <div className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
          {state.checkOnly && <p className="font-medium text-amber-700">Check only — nothing was saved.</p>}
          <p className="text-[#134229]">{state.checkOnly ? "Would add" : "Added"} {state.created} finding{state.created === 1 ? "" : "s"}.</p>
          {state.notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-gray-600">{state.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
          {state.errors.length > 0 && (
            <div>
              <p className="text-red-700">{state.errors.length} row{state.errors.length === 1 ? "" : "s"} skipped:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-600">{state.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
