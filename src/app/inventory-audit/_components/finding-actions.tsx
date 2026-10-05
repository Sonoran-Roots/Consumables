"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addFindingNote, assignFinding, changeFindingStatus } from "../findings/actions";
import type { AvailableAction } from "@/lib/ia/workflow";

const button = "rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50";
const ghost = "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export default function FindingActions({
  findingId, actions, canAssign, assigneeId, assignees,
}: {
  findingId: string;
  actions: AvailableAction[];
  canAssign: boolean;
  assigneeId: string;
  assignees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsNote = actions.some((a) => a.noteRequired);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, clear = true) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (clear) setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Note{needsNote ? " (required for resolve / reopen)" : ""}
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was done, or a comment for the history…"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.action} type="button" disabled={busy} className={a.action === "REOPEN" ? ghost : button}
            onClick={() => run(() => changeFindingStatus(findingId, a.action, note))}>
            {a.label}
          </button>
        ))}
        <button type="button" disabled={busy || !note.trim()} className={ghost}
          onClick={() => run(() => addFindingNote(findingId, note))}>
          Add note only
        </button>
      </div>

      {canAssign && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Assigned to</label>
          <select
            defaultValue={assigneeId}
            disabled={busy}
            onChange={(e) => run(() => assignFinding(findingId, e.target.value || null), false)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Nobody in particular</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
