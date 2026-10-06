"use client";

import { useActionState } from "react";
import { createAudit } from "../actions";

type Option = { id: string; name: string };
const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-gray-700";

export default function NewAuditForm({ facilities, departments, today, cultivation = false }: { facilities: Option[]; departments: Option[]; today: string; cultivation?: boolean }) {
  const [state, formAction, pending] = useActionState(createAudit, null);

  return (
    <form action={formAction} className="space-y-4">
      {cultivation && <input type="hidden" name="kind" value="cultivation" />}
      <div>
        <label className={label}>Audit name *</label>
        <input name="name" required placeholder={cultivation ? "e.g. 5th St Flower — October" : "e.g. 5th St Post Production — October"} className={input} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cultivation ? (
          <div>
            <label className={label}>Stage being audited *</label>
            <select name="stage" defaultValue="FLOWER" className={input}>
              <option value="CLONE">Clone</option>
              <option value="VEG">Veg</option>
              <option value="FLOWER">Flower</option>
              <option value="ALL">All stages</option>
            </select>
          </div>
        ) : (
          <div>
            <label className={label}>Dutchie audit type</label>
            <select name="dutchieType" defaultValue="" className={input}>
              <option value="">Not specified</option>
              <option value="RETAIL">Retail</option>
              <option value="PRODUCTION">Production</option>
              <option value="DISTRIBUTION">Distribution</option>
            </select>
          </div>
        )}
        <div>
          <label className={label}>Location *</label>
          <select name="facilityId" required defaultValue="" className={input}>
            <option value="" disabled>Select…</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Audit date *</label>
          <input type="date" name="auditDate" required defaultValue={today} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Findings go to department by default *</label>
          <select name="defaultDepartmentId" required defaultValue="" className={input}>
            <option value="" disabled>Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-400">Findings captured during the audit start here; you can reassign each one when you review them afterwards.</p>
        </div>
        <div>
          <label className={label}>Auditors</label>
          <input name="auditors" placeholder="e.g. MS/TL/KW" className={input} />
        </div>
      </div>
      <div>
        <label className={label}>Notes</label>
        <textarea name="notes" rows={2} className={input} />
      </div>
      <div>
        <label className={label}>{cultivation ? "Dutchie plant inventory export (CSV) *" : "Dutchie inventory export (CSV) *"}</label>
        <input
          name="file" type="file" accept=".csv,text/csv" required
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50">
        {pending ? "Loading lines…" : cultivation ? "Start cultivation audit" : "Start audit"}
      </button>
    </form>
  );
}
