"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { loadCompletedCounts } from "../actions";

export default function CountsUpload({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: Awaited<ReturnType<typeof loadCompletedCounts>>, fd: FormData) => {
    const r = await loadCompletedCounts(prev, fd);
    if (r && !r.checkOnly && r.errors.length === 0) router.refresh();
    return r;
  }, null);

  return (
    <details className="rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-gray-800">Load counts from the completed Dutchie audit table</summary>
      <p className="mt-2 text-sm text-gray-500">
        Upload the audit table from Dutchie after the counts (and adjustment reasons) have been filled in. Each row is matched to this
        audit&apos;s packages by Dutchie Id. Counts, the time counted, notes and reasons are recorded, and every package whose count
        changed becomes a finding. It&apos;s safe to upload again after fixing anything it reports.
      </p>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="auditId" value={auditId} />
        <input
          name="file" type="file" accept=".csv,text/csv" required
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="countUnchanged" defaultChecked className="mt-0.5" />
          <span>Packages Dutchie didn&apos;t change (count equals expected) count as audited OK. Untick to leave them pending.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="alreadyAdjusted" defaultChecked className="mt-0.5" />
          <span>The adjustments were already made in Dutchie when the audit was closed — mark them done. Untick if they still have to be made.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="checkOnly" className="mt-0.5" />
          <span>Check only — show what would happen without saving anything.</span>
        </label>
        <button type="submit" disabled={pending} className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50">
          {pending ? "Loading…" : "Load counts"}
        </button>
      </form>

      {state && (
        <div className="mt-3 space-y-2 rounded-md border border-gray-200 p-3 text-sm">
          {state.checkOnly && <p className="font-medium text-amber-700">Check only — nothing was saved.</p>}
          <p className="text-[#134229]">
            {state.matched} package{state.matched === 1 ? "" : "s"} matched · {state.countedOk} counted OK · {state.discrepancies} with a quantity change
          </p>
          {state.notes.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-gray-600">{state.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {state.errors.length > 0 && (
            <div>
              <p className="text-red-700">{state.errors.length} problem{state.errors.length === 1 ? "" : "s"}:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-600">{state.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul>
              {state.errors.length > 30 && <p className="mt-1 text-xs text-red-600">…and {state.errors.length - 30} more</p>}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
