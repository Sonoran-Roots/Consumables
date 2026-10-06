"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveLine, withdrawDiscrepancy } from "../actions";
import { fmtQty, isMismatch, type LineView } from "@/lib/ia/audit-rules";

type Category = { id: string; name: string };

const STATUS_STYLE = {
  PENDING: "border-gray-200 bg-white",
  OK: "border-green-200 bg-[#f3faf3]",
  DISCREPANCY: "border-red-200 bg-red-50",
} as const;

const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-base";

export default function AuditBoard({
  lines, categories, defaultCategoryId, canEdit, openId,
}: {
  lines: LineView[];
  categories: Category[];
  defaultCategoryId: string;
  canEdit: boolean;
  openId: string | null; // a scan that matched exactly one line opens it straight away
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(canEdit ? openId : null);
  // Lines saved here, kept until the server's copy catches up (newer version wins).
  const [saved, setSaved] = useState<Record<string, LineView>>({});

  const shown = lines.map((l) => {
    const mine = saved[l.id];
    return mine && Number(mine.version) >= Number(l.version) ? mine : l;
  });
  const active = shown.find((l) => l.id === activeId) ?? null;

  // Other auditors are counting in the same audit: pick up their work every
  // 20 seconds while this screen is idle (not while a count is being entered).
  useEffect(() => {
    if (activeId) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => clearInterval(t);
  }, [activeId, router]);

  function afterSave(line: LineView) {
    setSaved((prev) => ({ ...prev, [line.id]: line }));
    // Move on to the next uncounted line in this list.
    const i = shown.findIndex((l) => l.id === line.id);
    const next = [...shown.slice(i + 1), ...shown.slice(0, i)].find((l) => (saved[l.id] ?? l).status === "PENDING" && l.id !== line.id);
    setActiveId(next ? next.id : null);
    router.refresh();
  }

  return (
    <>
      <ul className="space-y-2">
        {shown.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              disabled={!canEdit && l.status === "PENDING"}
              onClick={() => setActiveId(l.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm active:scale-[0.99] ${STATUS_STYLE[l.status]} ${canEdit ? "hover:border-black" : ""}`}
            >
              <span className="w-10 shrink-0 text-xs tabular-nums text-gray-400">{l.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-gray-900">{l.product ?? l.strain ?? l.batchId ?? l.pid ?? `Line ${l.position}`}</span>
                <span className="block truncate text-xs text-gray-500">
                  {[l.product ? l.strain : null, l.batchId && `Batch ${l.batchId}`, l.pid && `PID ${l.pid}`, l.serialNo && `Serial ${l.serialNo}`, l.room].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs text-gray-400">System</span>
                <span className="block text-base font-semibold tabular-nums text-gray-900">{fmtQty(l.systemQty, l.unit)}</span>
              </span>
              <span className="w-24 shrink-0 text-right">
                {l.status === "PENDING" ? (
                  <span className="text-sm text-gray-400">Pending</span>
                ) : (
                  <>
                    <span className={`block text-base font-semibold tabular-nums ${l.status === "DISCREPANCY" ? "text-red-700" : "text-[#134229]"}`}>
                      {fmtQty(l.actualQty)}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {l.status === "DISCREPANCY" ? "Discrepancy" : "OK"}{l.countedByName ? ` · ${l.countedByName.split(" ")[0]}` : ""}
                    </span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">No lines match.</li>
        )}
      </ul>

      {active && canEdit && (
        <CountPanel
          key={`${active.id}:${active.version}`}
          line={active}
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          onClose={() => setActiveId(null)}
          onSaved={afterSave}
        />
      )}
    </>
  );
}

function CountPanel({
  line, categories, defaultCategoryId, onClose, onSaved,
}: {
  line: LineView;
  categories: Category[];
  defaultCategoryId: string;
  onClose: () => void;
  onSaved: (line: LineView) => void;
}) {
  const [qty, setQty] = useState(line.actualQty !== null ? String(line.actualQty) : "");
  const [flag, setFlag] = useState(line.status === "DISCREPANCY" && !isMismatch(line.systemQty, line.actualQty));
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [note, setNote] = useState(line.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const entered = qty.trim() === "" ? null : Number(qty);
  const valid = entered === null || (Number.isFinite(entered) && entered >= 0);
  const mismatch = isMismatch(line.systemQty, valid ? entered : null);
  const documenting = mismatch || flag;
  const diff = mismatch && entered !== null && line.systemQty !== null ? entered - line.systemQty : 0;

  async function submit(force = false, quickQty?: number) {
    setBusy(true);
    setError(null);
    setConflict(null);
    const actual = quickQty ?? (valid ? entered : null);
    const r = await saveLine({
      lineId: line.id, actualQty: actual, version: line.version, force,
      discrepancy: quickQty === undefined && (isMismatch(line.systemQty, actual) || flag) ? { categoryId, note: note.trim() || null } : undefined,
    });
    setBusy(false);
    if (r.ok) return onSaved(r.line);
    if (r.conflict) return setConflict(`${r.error}${r.conflict.actualQty !== null ? ` They counted ${fmtQty(r.conflict.actualQty)}.` : ""}`);
    setError(r.error);
  }

  async function withdraw() {
    setBusy(true);
    setError(null);
    const r = await withdrawDiscrepancy(line.id);
    setBusy(false);
    if (r.ok) onSaved(r.line);
    else setError(r.error);
  }

  const label = line.product ?? line.strain ?? line.batchId ?? line.pid ?? `Line ${line.position}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-gray-500">
              {[line.product ? line.strain : null, line.batchId && `Batch ${line.batchId}`, line.pid && `PID ${line.pid}`, line.serialNo && `Serial ${line.serialNo}`, line.room].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full px-2 py-1 text-xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close">×</button>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-400">System says</p>
          <p className="text-3xl font-semibold tabular-nums text-gray-900">{fmtQty(line.systemQty, line.unit)}</p>
        </div>

        {line.findingId && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            A finding is documented for this line.{" "}
            <Link href={`/inventory-audit/findings/${line.findingId}`} className="font-medium underline">View it</Link>
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-gray-700">What did you count?</label>
        <input
          autoFocus
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy && valid && !(documenting && !categoryId)) void submit(); }}
          placeholder="Physical count"
          className={`${input} mt-1 text-center text-2xl font-semibold tabular-nums`}
        />
        {entered !== null && valid && line.systemQty !== null && (
          <p className={`mt-1 text-center text-sm font-medium ${mismatch ? "text-red-700" : "text-[#134229]"}`}>
            {mismatch ? `${diff > 0 ? "+" : ""}${Math.round(diff * 1000) / 1000} — doesn't match` : "Matches"}
          </p>
        )}

        {!mismatch && !line.findingId && (
          <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>Flag a problem anyway (wrong tag, room, status, label…)</span>
          </label>
        )}

        {documenting && (
          <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">Document the discrepancy</p>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input} aria-label="Kind of discrepancy">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What did you see? (optional)" className={input} />
          </div>
        )}

        {conflict && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {conflict}
            <button type="button" onClick={() => submit(true)} className="ml-2 font-medium underline">Save mine anyway</button>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={busy || !valid || (documenting && !categoryId)}
            onClick={() => submit()}
            className="rounded-xl border border-black bg-black py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : documenting ? "Save discrepancy & next" : "Save count & next"}
          </button>
          {line.systemQty !== null && !line.findingId && (
            <button type="button" disabled={busy} onClick={() => submit(false, line.systemQty!)} className="rounded-xl border border-gray-300 bg-white py-3 text-base font-medium text-gray-800 disabled:opacity-40">
              Matches the system ({fmtQty(line.systemQty, line.unit)})
            </button>
          )}
          {line.findingId && (
            <button type="button" disabled={busy} onClick={withdraw} className="rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40">
              Counted wrong — withdraw this discrepancy
            </button>
          )}
        </div>
        {line.countedByName && line.countedAt && (
          <p className="mt-3 text-center text-xs text-gray-400">
            Last saved by {line.countedByName} · {new Date(line.countedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
      </div>
    </div>
  );
}
