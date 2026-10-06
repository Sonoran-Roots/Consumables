"use client";

import { useActionState } from "react";
import { createAudit } from "../actions";

type Option = { id: string; name: string };
const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-gray-700";

export default function NewAuditForm({ facilities, departments, today }: { facilities: Option[]; departments: Option[]; today: string }) {
  const [state, formAction, pending] = useActionState(createAudit, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={label}>Audit name *</label>
        <input name="name" required placeholder="e.g. 5th St Post Production — October" className={input} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Audit type *</label>
          <select name="auditType" defaultValue="PRODUCT" className={input}>
            <option value="PRODUCT">Product audit</option>
            <option value="PLANT">Plant room audit</option>
            <option value="WASTE_LOG">Waste log audit</option>
          </select>
        </div>
        <div>
          <label className={label}>Facility *</label>
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
          <label className={label}>Findings go to department *</label>
          <select name="defaultDepartmentId" required defaultValue="" className={input}>
            <option value="" disabled>Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-400">Every finding documented in this audit is attributed here; change it on a finding if needed.</p>
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
        <label className={label}>CSV of lines to audit *</label>
        <input
          name="file" type="file" accept=".csv,text/csv" required
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50">
        {pending ? "Loading lines…" : "Start audit"}
      </button>
    </form>
  );
}
