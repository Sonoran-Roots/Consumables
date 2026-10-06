"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveLine } from "../actions";
import {
  FIELD_DEFS, LABEL_CHECK_FIELDS, WHOLE_LABEL_ISSUES, fieldDef, fieldLabel, fmtQty, isMismatch,
  type FlagField, type LineView,
} from "@/lib/ia/audit-rules";

const STATUS_STYLE = {
  PENDING: "border-gray-200 bg-white",
  OK: "border-green-200 bg-[#f3faf3]",
  DISCREPANCY: "border-red-200 bg-red-50",
} as const;

const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-base";

export default function AuditBoard({
  lines, canEdit, openId,
}: {
  lines: LineView[];
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
  // 20 seconds while this screen is idle (not while an item is open).
  useEffect(() => {
    if (activeId) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => clearInterval(t);
  }, [activeId, router]);

  function afterSave(line: LineView) {
    setSaved((prev) => ({ ...prev, [line.id]: line }));
    // Move on to the next uncounted item in this list.
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
              disabled={!canEdit}
              onClick={() => setActiveId(l.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm active:scale-[0.99] ${STATUS_STYLE[l.status]} ${canEdit ? "hover:border-black" : ""}`}
            >
              <span className="w-10 shrink-0 text-xs tabular-nums text-gray-400">{l.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-gray-900">{l.product ?? l.strain ?? l.batchId ?? l.pid ?? `Line ${l.position}`}</span>
                <span className="block truncate text-xs text-gray-500">
                  {[l.pid && `PID ${l.pid}`, l.batchId && `Batch ${l.batchId}`, l.serialNo && `Tag ${l.serialNo}`, l.room].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs text-gray-400">System</span>
                <span className="block text-base font-semibold tabular-nums text-gray-900">{fmtQty(l.systemQty, l.unit)}</span>
              </span>
              <span className="w-28 shrink-0 text-right">
                {l.status === "PENDING" ? (
                  <span className="text-sm text-gray-400">Pending</span>
                ) : (
                  <>
                    <span className={`block text-base font-semibold tabular-nums ${l.status === "DISCREPANCY" ? "text-red-700" : "text-[#134229]"}`}>
                      {fmtQty(l.actualQty)}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {l.issues.length > 0 ? `${l.issues.length} issue${l.issues.length === 1 ? "" : "s"}` : "OK"}
                      {l.countedByName ? ` · ${l.countedByName.split(" ")[0]}` : ""}
                    </span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">No items match.</li>
        )}
      </ul>

      {active && canEdit && (
        <ItemPanel key={`${active.id}:${active.version}`} line={active} onClose={() => setActiveId(null)} onSaved={afterSave} />
      )}
    </>
  );
}

type Flag = { foundValue: string; note: string };

function ItemPanel({ line, onClose, onSaved }: { line: LineView; onClose: () => void; onSaved: (line: LineView) => void }) {
  const [qty, setQty] = useState(line.actualQty !== null ? String(line.actualQty) : "");
  const [labelOk, setLabelOk] = useState(line.labelVerified);
  const [flags, setFlags] = useState<Record<string, Flag>>(() =>
    Object.fromEntries(line.issues.filter((i) => i.field !== "COUNT").map((i) => [i.field, { foundValue: i.foundValue ?? "", note: i.note ?? "" }]))
  );
  const [countNote, setCountNote] = useState(line.issues.find((i) => i.field === "COUNT")?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const entered = qty.trim() === "" ? null : Number(qty);
  const validCount = entered !== null && Number.isFinite(entered) && entered >= 0;
  const mismatch = validCount && isMismatch(line.systemQty, entered);
  const diff = mismatch && entered !== null && line.systemQty !== null ? entered - line.systemQty : 0;
  const flagCount = Object.keys(flags).length;
  const canSave = validCount && (labelOk || flagCount > 0);

  const toggle = (field: FlagField) =>
    setFlags((prev) => {
      const next = { ...prev };
      if (next[field]) delete next[field];
      else next[field] = { foundValue: "", note: "" };
      return next;
    });
  const setFlag = (field: FlagField, patch: Partial<Flag>) => setFlags((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));

  async function submit(force = false) {
    setBusy(true);
    setError(null);
    setConflict(null);
    const r = await saveLine({
      lineId: line.id,
      actualQty: validCount ? entered : null,
      labelVerified: labelOk,
      countNote: mismatch ? countNote.trim() || null : null,
      issues: Object.entries(flags).map(([field, f]) => ({ field: field as FlagField, foundValue: f.foundValue.trim() || null, note: f.note.trim() || null })),
      version: line.version,
      force,
    });
    setBusy(false);
    if (r.ok) return onSaved(r.line);
    if (r.conflict) return setConflict(`${r.error}${r.conflict.actualQty !== null ? ` They counted ${fmtQty(r.conflict.actualQty)}.` : ""}`);
    setError(r.error);
  }

  const systemValue = (f: FlagField) => fieldDef(f)?.read?.(line) ?? null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight text-gray-900">{line.product ?? line.strain ?? line.batchId ?? `Line ${line.position}`}</p>
            {line.pid && <p className="mt-0.5 font-mono text-sm text-gray-600">PID {line.pid}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full px-2 py-1 text-xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close">×</button>
        </div>

        {/* 1. The label */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800">1. Check the label against the system</p>
          <button
            type="button"
            onClick={() => setLabelOk((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${labelOk ? "bg-[#134229] text-white" : "border border-gray-300 text-gray-700"}`}
          >
            {labelOk ? "✓ Label matches" : flagCount > 0 ? "Rest of label matches" : "Label matches"}
          </button>
        </div>
        <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {LABEL_CHECK_FIELDS.map((field) => {
            const flagged = flags[field];
            const sys = systemValue(field);
            return (
              <li key={field} className={flagged ? "bg-red-50" : ""}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">{fieldLabel(field)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{sys ?? "—"}</span>
                  <button
                    type="button"
                    onClick={() => toggle(field)}
                    aria-pressed={!!flagged}
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${flagged ? "bg-red-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                  >
                    {flagged ? "Wrong ✗" : "Wrong?"}
                  </button>
                </div>
                {flagged && (
                  <div className="space-y-2 px-3 pb-3">
                    <input value={flagged.foundValue} onChange={(e) => setFlag(field, { foundValue: e.target.value })} placeholder={`What does the label show for ${fieldLabel(field).toLowerCase()}?`} className={input} />
                    <input value={flagged.note} onChange={(e) => setFlag(field, { note: e.target.value })} placeholder="Note (optional)" className={input} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          {WHOLE_LABEL_ISSUES.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => toggle(field)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${flags[field] ? "bg-red-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {FIELD_DEFS.find((d) => d.key === field)!.label}
            </button>
          ))}
        </div>
        {WHOLE_LABEL_ISSUES.filter((f) => flags[f]).map((field) => (
          <input key={field} value={flags[field].note} onChange={(e) => setFlag(field, { note: e.target.value })} placeholder={`${fieldLabel(field)} — describe it`} className={`${input} mt-2`} />
        ))}

        {/* 2. The count */}
        <p className="mt-5 text-sm font-medium text-gray-800">2. Count it</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="w-32 shrink-0 rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-400">System</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900">{fmtQty(line.systemQty, line.unit)}</p>
            {line.allocatedQty ? <p className="text-xs text-gray-400">{fmtQty(line.allocatedQty)} allocated</p> : null}
          </div>
          <input
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Counted"
            autoFocus
            className={`${input} text-center text-2xl font-semibold tabular-nums`}
          />
        </div>
        {validCount && line.systemQty !== null && (
          <p className={`mt-1 text-center text-sm font-medium ${mismatch ? "text-red-700" : "text-[#134229]"}`}>
            {mismatch ? `${diff > 0 ? "+" : ""}${Math.round(diff * 1000) / 1000} — doesn't match the system` : "Matches the system"}
          </p>
        )}
        {mismatch && (
          <textarea value={countNote} onChange={(e) => setCountNote(e.target.value)} rows={2} placeholder="What happened? (optional)" className={`${input} mt-2`} />
        )}

        {conflict && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {conflict}
            <button type="button" onClick={() => submit(true)} className="ml-2 font-medium underline">Save mine anyway</button>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        {(mismatch || flagCount > 0) && (
          <p className="mt-3 text-center text-xs text-red-700">
            {(mismatch ? 1 : 0) + flagCount} discrepanc{(mismatch ? 1 : 0) + flagCount === 1 ? "y" : "ies"} will be documented with the time found
          </p>
        )}
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={() => submit()}
          className="mt-3 w-full rounded-xl border border-black bg-black py-3 text-base font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save & next"}
        </button>
        {!canSave && <p className="mt-2 text-center text-xs text-gray-400">{!validCount ? "Enter the count to save." : "Confirm the label matches, or mark what's wrong."}</p>}

        {line.issues.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {line.issues.map((i) => (
              <p key={i.id}>
                <Link href={`/inventory-audit/findings/${i.id}`} className="font-medium text-gray-700 underline">{fieldLabel(i.field)}</Link>{" "}
                found {new Date(i.foundAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                {i.reviewed ? " · reviewed" : " · awaiting review"}
              </p>
            ))}
          </div>
        )}
        {line.countedByName && line.countedAt && (
          <p className="mt-2 text-center text-xs text-gray-400">
            Last saved by {line.countedByName} · {new Date(line.countedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
      </div>
    </div>
  );
}
