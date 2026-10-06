"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setLoginPassword, signOutEverywhere, updateAuditAccess, updateLoginDetails, updateUserAccess,
} from "../../actions";
import { CreateAccessForm, LinkExistingForm } from "../../employee-access-cell";
import { AUDIT_ROLES, auditRoleLabel, type AuditRole, type StaffRole } from "@/lib/access";

export type PanelUser = { id: string; name: string; email: string; role: string; isPurchasingTeam: boolean; auditRole: string | null };

const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-gray-700";
const btn = "rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50";
const ghost = "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

const CONSUMABLE_LEVELS: { value: StaffRole; name: string; text: string }[] = [
  { value: "USER", name: "User", text: "Day-to-day work: inventory, transfers, check-outs, audits and reconciliation." },
  { value: "MANAGER", name: "Manager", text: "Also purchasing, vendors, and viewing the setup lists." },
  { value: "ADMIN", name: "Admin", text: "Everything, including setup, bulk import and managing people." },
];
const AUDIT_TEXT: Record<AuditRole, string> = {
  AUDITOR: "Counts items in audits and documents discrepancies.",
  AUDIT_MANAGER: "Also starts audits, reviews findings and runs the adjustments report.",
  MANAGER: "A department manager that findings are routed to and followed up with.",
  ADMIN: "Everything in the module, including its settings.",
};

type Msg = { kind: "ok" | "err"; text: string } | null;
const Note = ({ m }: { m: Msg }) => (m ? <span className={`text-sm ${m.kind === "ok" ? "text-[#134229]" : "text-red-700"}`}>{m.text}</span> : null);

// Everything about one person's login and what it opens, in one place. Shown
// to admins of any module.
export default function AccountPanel({ employeeId, employeeName, user, isSelf }: { employeeId: string; employeeName: string; user: PanelUser | null; isSelf: boolean }) {
  const router = useRouter();

  if (!user) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">Login &amp; module access</h2>
        <p className="mt-1 text-sm text-gray-500">{employeeName} has no login yet, so they can only use the kiosk. Give them one to open a module.</p>
        <NoLogin employeeId={employeeId} employeeName={employeeName} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <ModuleAccess user={user} isSelf={isSelf} onSaved={() => router.refresh()} />
      <LoginDetails user={user} onSaved={() => router.refresh()} />
    </div>
  );
}

function NoLogin({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [mode, setMode] = useState<"idle" | "create" | "link">("idle");
  if (mode === "create") return <div className="mt-3"><CreateAccessForm employeeId={employeeId} employeeName={employeeName} onCancel={() => setMode("idle")} /></div>;
  if (mode === "link") return <div className="mt-3"><LinkExistingForm employeeId={employeeId} onCancel={() => setMode("idle")} /></div>;
  return (
    <div className="mt-3 flex gap-2">
      <button type="button" className={btn} onClick={() => setMode("create")}>Give app access</button>
      <button type="button" className={ghost} onClick={() => setMode("link")}>Link existing login</button>
    </div>
  );
}

function ModuleAccess({ user, isSelf, onSaved }: { user: PanelUser; isSelf: boolean; onSaved: () => void }) {
  const [hasConsumables, setHasConsumables] = useState(user.isPurchasingTeam);
  const [role, setRole] = useState<StaffRole>(user.role as StaffRole);
  const [auditRole, setAuditRole] = useState(user.auditRole ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const consumablesDirty = hasConsumables !== user.isPurchasingTeam || role !== user.role;
  const auditDirty = auditRole !== (user.auditRole ?? "");

  async function save() {
    setBusy(true);
    setMsg(null);
    const results = [];
    if (consumablesDirty) results.push(await updateUserAccess(user.id, role, hasConsumables));
    if (auditDirty) results.push(await updateAuditAccess(user.id, auditRole || null));
    setBusy(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) return setMsg({ kind: "err", text: failed.error });
    setMsg({ kind: "ok", text: isSelf ? "Saved. Your own change applies within a few minutes." : "Saved. It applies within a few minutes." });
    onSaved();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">Module access</h2>
      <p className="mt-1 text-sm text-gray-500">Each module has its own level. Someone with neither can only use the kiosk.</p>

      <div className="mt-4 space-y-4">
        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="px-1 text-sm font-medium text-gray-800">Consumable Management</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={hasConsumables} onChange={(e) => setHasConsumables(e.target.checked)} className="rounded border-gray-300" />
            Can open this module
          </label>
          <select value={role} disabled={!hasConsumables} onChange={(e) => setRole(e.target.value as StaffRole)} className={`${input} disabled:opacity-40`} aria-label="Consumable Management level">
            {CONSUMABLE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">{CONSUMABLE_LEVELS.find((l) => l.value === role)?.text}</p>
        </fieldset>

        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="px-1 text-sm font-medium text-gray-800">Inventory Audit</legend>
          <select value={auditRole} onChange={(e) => setAuditRole(e.target.value)} className={input} aria-label="Inventory Audit level">
            <option value="">No access</option>
            {AUDIT_ROLES.map((r) => <option key={r} value={r}>{auditRoleLabel(r)}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">{auditRole ? AUDIT_TEXT[auditRole as AuditRole] : "They can't open the Inventory Audit module."}</p>
        </fieldset>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy || !(consumablesDirty || auditDirty)} onClick={save} className={btn}>{busy ? "Saving…" : "Save access"}</button>
        <Note m={msg} />
      </div>
    </div>
  );
}

function LoginDetails({ user, onSaved }: { user: PanelUser; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [detailsMsg, setDetailsMsg] = useState<Msg>(null);
  const [passMsg, setPassMsg] = useState<Msg>(null);
  const [signOutMsg, setSignOutMsg] = useState<Msg>(null);

  async function saveDetails() {
    setBusy("details");
    const r = await updateLoginDetails(user.id, email, name);
    setBusy(null);
    setDetailsMsg(r.ok ? { kind: "ok", text: "Saved." } : { kind: "err", text: r.error });
    if (r.ok) onSaved();
  }
  async function savePassword() {
    if (!confirm(`Set a new password for ${user.email}? They'll be signed out everywhere and need the new password.`)) return;
    setBusy("password");
    const r = await setLoginPassword(user.id, password);
    setBusy(null);
    setPassMsg(r.ok ? { kind: "ok", text: "Password changed. Share it with them securely." } : { kind: "err", text: r.error });
    if (r.ok) setPassword("");
  }
  async function signOutAll() {
    if (!confirm(`Sign ${user.email} out of every device?`)) return;
    setBusy("signout");
    const r = await signOutEverywhere(user.id);
    setBusy(null);
    setSignOutMsg(r.ok ? { kind: "ok", text: "Signed out everywhere." } : { kind: "err", text: r.error });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">Login</h2>
      <div className="mt-3 space-y-3">
        <div>
          <label className={label}>Name on the login</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Email they sign in with</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className={btn} disabled={busy !== null || (name === user.name && email === user.email)} onClick={saveDetails}>
            {busy === "details" ? "Saving…" : "Save login"}
          </button>
          <Note m={detailsMsg} />
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <label className={label}>Set a new password</label>
        <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" className={input} />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" className={btn} disabled={busy !== null || password.length < 8} onClick={savePassword}>
            {busy === "password" ? "Changing…" : "Change password"}
          </button>
          <Note m={passMsg} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5">
        <button type="button" className={ghost} disabled={busy !== null} onClick={signOutAll}>Sign out of all devices</button>
        <Note m={signOutMsg} />
      </div>
    </div>
  );
}
