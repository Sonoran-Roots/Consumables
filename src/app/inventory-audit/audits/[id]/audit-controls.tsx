"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAudit, finishAudit, reopenAuditAction } from "../actions";

const btn = "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const primary = "rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50";

export default function AuditControls({
  auditId, status, pending, isAdmin, exportHref,
}: {
  auditId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  pending: number;
  isAdmin: boolean;
  exportHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (then) then();
    else router.refresh();
  }

  async function complete() {
    setBusy(true);
    setError(null);
    let r = await finishAudit(auditId, false);
    if (!r.ok && r.pending) {
      // Uncounted lines: make the auditor confirm they mean to leave them.
      if (confirm(`${r.pending.toLocaleString("en-US")} line${r.pending === 1 ? " is" : "s are"} still uncounted. Complete the audit anyway?`)) {
        r = await finishAudit(auditId, true);
      } else {
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={exportHref} className={btn}>Download CSV</a>
      {status === "IN_PROGRESS" && (
        <button type="button" disabled={busy} className={primary} onClick={complete}>
          {pending > 0 ? "Complete audit…" : "Complete audit"}
        </button>
      )}
      {status === "COMPLETED" && isAdmin && (
        <button type="button" disabled={busy} className={btn} onClick={() => run(() => reopenAuditAction(auditId))}>Reopen</button>
      )}
      {isAdmin && (
        <button
          type="button" disabled={busy}
          className="text-xs text-gray-400 hover:text-red-600 hover:underline"
          onClick={() => {
            if (confirm("Delete this audit and all its lines? This can't be undone.")) {
              void run(() => deleteAudit(auditId), () => router.push("/inventory-audit/audits"));
            }
          }}
        >
          Delete
        </button>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
