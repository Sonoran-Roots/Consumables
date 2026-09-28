"use client";

import { useState } from "react";
import { updateUserAccess } from "./actions";
import { useSession } from "@/lib/auth-client";
import type { StaffRole } from "@/lib/access";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isPurchasingTeam: boolean;
};

const ROLES: StaffRole[] = ["USER", "MANAGER", "ADMIN"];

function Row({ user }: { user: UserRow }) {
  const { data: session } = useSession();
  const isSelf = session?.user?.id === user.id;
  const [role, setRole] = useState<StaffRole>(user.role as StaffRole);
  const [isPurchasingTeam, setIsPurchasingTeam] = useState(user.isPurchasingTeam);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = role !== user.role || isPurchasingTeam !== user.isPurchasingTeam;

  async function handleSave() {
    if (
      isSelf &&
      (!isPurchasingTeam || role !== "ADMIN") &&
      !confirm("This removes your own admin/purchasing-team access. You won't be able to undo this yourself. Continue?")
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateUserAccess(user.id, role, isPurchasingTeam);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <tr>
      <td className="px-4 py-2.5">
        <p className="font-medium text-gray-900">
          {user.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
        </p>
        <p className="text-xs text-gray-500">{user.email}</p>
      </td>
      <td className="px-3 py-2.5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPurchasingTeam}
            onChange={(e) => setIsPurchasingTeam(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Purchasing team</span>
        </label>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={role}
          disabled={!isPurchasingTeam}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-40"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5 text-right">
        {error && <span className="mr-2 text-xs text-red-700">{error}</span>}
        {saved && <span className="mr-2 text-xs text-[#134229]">Saved</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-md border border-black bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-white hover:text-black disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Account</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Desktop app access</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Role</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => (
            <Row key={u.id} user={u} />
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                No accounts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
