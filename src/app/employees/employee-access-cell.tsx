"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAppAccessForEmployee,
  linkExistingAccount,
  unlinkAppAccess,
  updateAuditAccess,
  updateUserAccess,
} from "./actions";
import { AUDIT_ROLES, auditRoleLabel, type StaffRole } from "@/lib/access";

type LinkedUser = {
  id: string;
  email: string;
  role: string;
  isPurchasingTeam: boolean;
  auditRole: string | null;
} | null;

const ROLES: StaffRole[] = ["USER", "MANAGER", "ADMIN"];
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default function EmployeeAccessCell({
  employeeId,
  employeeName,
  user,
  isAdmin,
}: {
  employeeId: string;
  employeeName: string;
  user: LinkedUser;
  isAdmin: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "create" | "link">("idle");

  if (!isAdmin) {
    const parts: string[] = [];
    if (user?.isPurchasingTeam) parts.push(`Consumables (${titleCase(user.role)})`);
    if (user?.auditRole) parts.push(`Audit (${auditRoleLabel(user.auditRole)})`);
    return (
      <span className="text-sm text-gray-500">{parts.length ? parts.join(" · ") : "Kiosk only"}</span>
    );
  }

  if (!user) {
    if (mode === "create") {
      return (
        <CreateAccessForm
          employeeId={employeeId}
          employeeName={employeeName}
          onCancel={() => setMode("idle")}
        />
      );
    }
    if (mode === "link") {
      return (
        <LinkExistingForm employeeId={employeeId} onCancel={() => setMode("idle")} />
      );
    }
    return (
      <span className="text-sm text-gray-500">
        Kiosk only ·{" "}
        <button
          type="button"
          onClick={() => setMode("create")}
          className="text-gray-700 hover:text-gray-900 hover:underline"
        >
          Give app access
        </button>{" "}
        ·{" "}
        <button
          type="button"
          onClick={() => setMode("link")}
          className="text-gray-700 hover:text-gray-900 hover:underline"
        >
          Link existing
        </button>
      </span>
    );
  }

  return <ExistingAccessRow employeeId={employeeId} user={user} />;
}

function LinkExistingForm({
  employeeId,
  onCancel,
}: {
  employeeId: string;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await linkExistingAccount(employeeId, email);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-64 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-700">Link an existing login</p>
      <input
        type="email"
        required
        placeholder="Their account email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
        >
          {pending ? "Linking…" : "Link"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CreateAccessForm({
  employeeId,
  employeeName,
  onCancel,
}: {
  employeeId: string;
  employeeName: string;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("USER");
  const [isPurchasingTeam, setIsPurchasingTeam] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createAppAccessForEmployee(
      employeeId,
      email,
      password,
      role,
      isPurchasingTeam
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-64 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-700">New login for {employeeName}</p>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Temporary password (8+ chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={isPurchasingTeam}
            onChange={(e) => setIsPurchasingTeam(e.target.checked)}
            className="rounded border-gray-300"
          />
          Purchasing team
        </label>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create login"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ExistingAccessRow({
  employeeId,
  user,
}: {
  employeeId: string;
  user: { id: string; email: string; role: string; isPurchasingTeam: boolean; auditRole: string | null };
}) {
  const [role, setRole] = useState<StaffRole>(user.role as StaffRole);
  const [isPurchasingTeam, setIsPurchasingTeam] = useState(user.isPurchasingTeam);
  const [auditRole, setAuditRole] = useState<string>(user.auditRole ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const consumablesDirty = role !== user.role || isPurchasingTeam !== user.isPurchasingTeam;
  const auditDirty = auditRole !== (user.auditRole ?? "");
  const dirty = consumablesDirty || auditDirty;

  async function handleSave() {
    setSaving(true);
    setError(null);
    // Two modules, two independent settings — save only what changed.
    const results = [];
    if (consumablesDirty) results.push(await updateUserAccess(user.id, role, isPurchasingTeam));
    if (auditDirty) results.push(await updateAuditAccess(user.id, auditRole || null));
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      setError(failed.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleUnlink() {
    if (!confirm(`Remove ${user.email}'s link to this employee? The login itself keeps working — it just won't show as this person's account anymore.`)) {
      return;
    }
    await unlinkAppAccess(employeeId);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">{user.email}</span>
      <label className="flex items-center gap-1 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={isPurchasingTeam}
          onChange={(e) => setIsPurchasingTeam(e.target.checked)}
          className="rounded border-gray-300"
        />
        Consumables
      </label>
      <select
        value={role}
        disabled={!isPurchasingTeam}
        onChange={(e) => setRole(e.target.value as StaffRole)}
        className="rounded-md border border-gray-300 px-1.5 py-0.5 text-xs disabled:opacity-40"
        aria-label="Consumables access level"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {titleCase(r)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-700">
        Audit
        <select
          value={auditRole}
          onChange={(e) => setAuditRole(e.target.value)}
          className="rounded-md border border-gray-300 px-1.5 py-0.5 text-xs"
          aria-label="Inventory Audit access level"
        >
          <option value="">No access</option>
          {AUDIT_ROLES.map((r) => (
            <option key={r} value={r}>
              {auditRoleLabel(r)}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="text-xs text-red-700">{error}</span>}
      {saved && <span className="text-xs text-[#134229]">Saved</span>}
      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saving}
        className="rounded-md border border-black bg-black px-2 py-0.5 text-xs font-medium text-white hover:bg-white hover:text-black disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400"
      >
        {saving ? "…" : "Save"}
      </button>
      <button type="button" onClick={handleUnlink} className="text-xs text-gray-400 hover:text-red-600 hover:underline">
        Unlink
      </button>
    </div>
  );
}
