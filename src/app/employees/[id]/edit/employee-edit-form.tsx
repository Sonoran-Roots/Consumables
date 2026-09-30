"use client";

import { useActionState, useState, useTransition } from "react";
import { updateEmployee, resetEmployeeKioskPin } from "../../actions";
import type { Employee, Site } from "@prisma/client";

export default function EmployeeEditForm({
  employee,
  sites,
  hasPin,
}: {
  employee: Omit<Employee, "pinDigest">;
  sites: Site[];
  hasPin: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateEmployee, null);
  const [pinCleared, setPinCleared] = useState(false);
  const [resetting, startReset] = useTransition();

  function handleResetPin() {
    if (!confirm(`Clear ${employee.name}'s kiosk PIN? They'll set a new one at the kiosk (Forgot your PIN?).`)) {
      return;
    }
    startReset(async () => {
      await resetEmployeeKioskPin(employee.id);
      setPinCleared(true);
    });
  }

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

      <div>
        <label className="block text-sm font-medium text-gray-700">Kiosk PIN-reset authority</label>
        <select
          name="role"
          defaultValue={employee.role}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="USER">User — can't approve PIN resets</option>
          <option value="MANAGER">Manager — can approve a coworker's forgotten-PIN reset at the kiosk</option>
          <option value="ADMIN">Admin — same as Manager, for kiosk purposes</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Unrelated to desktop app access — that&apos;s managed from the{" "}
          <a href="/employees" className="underline">
            Employees list
          </a>
          .
        </p>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-700">Kiosk PIN</p>
        {pinCleared || !hasPin ? (
          <p className="mt-1 text-sm text-gray-500">
            {pinCleared
              ? "Cleared — they can set a new one at the kiosk by tapping “Forgot your PIN?”."
              : "Not set yet — they can create one at the kiosk by tapping “Forgot your PIN?”."}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500">
              Set. It's stored as a one-way digest — nobody, including you, can view it. If they
              forgot it, clear it below and they'll set a new one at the kiosk.
            </p>
            <button
              type="button"
              onClick={handleResetPin}
              disabled={resetting}
              className="mt-2 rounded-md px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              {resetting ? "Clearing…" : "Clear PIN"}
            </button>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
