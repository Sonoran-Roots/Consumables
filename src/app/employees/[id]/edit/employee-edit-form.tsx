"use client";

import { useActionState } from "react";
import { updateEmployee } from "../../actions";
import type { Employee, Site } from "@prisma/client";

export default function EmployeeEditForm({
  employee,
  sites,
}: {
  employee: Employee;
  sites: Site[];
}) {
  const [state, formAction, pending] = useActionState(updateEmployee, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="employeeId" value={employee.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          name="name"
          required
          defaultValue={employee.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Initials (optional, for legacy mapping)
        </label>
        <input
          name="initials"
          maxLength={4}
          defaultValue={employee.initials ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Home site</label>
        <select
          name="siteId"
          defaultValue={employee.siteId ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Unspecified</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={employee.isActive}
          className="rounded border-gray-300"
        />
        Active
      </label>
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
