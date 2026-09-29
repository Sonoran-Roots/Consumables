"use client";

import { useEffect, useMemo, useState } from "react";
import { getLayerOptions } from "./actions";
import {
  consumeLayers,
  costKey,
  fmtCost,
  groupLayersByCost,
  type CostLayer,
} from "@/lib/cost-allocation";
import type { Item } from "@prisma/client";

export type LineDraft = {
  key: number;
  itemId: string;
  quantity: string;
  // "FIFO" or the costKey of a specific layer at the source site.
  choice: string;
};

let nextKey = 1;
export function newLine(partial: Partial<Omit<LineDraft, "key">> = {}): LineDraft {
  return { key: nextKey++, itemId: "", quantity: "", choice: "FIFO", ...partial };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { timeZone: "UTC" });
}

// Item + quantity + "which cost?" rows for a transfer. Nobody types a cost
// here — it defaults to FIFO (oldest stock at the source site goes first)
// and can be switched to a specific priced batch when you're deliberately
// moving that one. Costs themselves only ever come from POs.
export default function TransferLinesEditor({
  items,
  fromSiteId,
  excludeTransferId,
  initialLines,
}: {
  items: Item[];
  fromSiteId: string;
  excludeTransferId?: string;
  initialLines: LineDraft[];
}) {
  const [lines, setLines] = useState<LineDraft[]>(initialLines);

  function update(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Items *</label>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, newLine()])}
          className="text-sm text-[#134229] hover:underline"
        >
          + Add line
        </button>
      </div>
      {!fromSiteId && (
        <p className="mt-1 text-xs text-gray-500">
          Pick the source site first — costs come from what&apos;s on hand there.
        </p>
      )}
      <div className="mt-2 space-y-3">
        {lines.map((line) => (
          <LineRow
            key={line.key}
            line={line}
            items={items}
            fromSiteId={fromSiteId}
            excludeTransferId={excludeTransferId}
            onChange={(patch) => update(line.key, patch)}
            onRemove={
              lines.length > 1
                ? () => setLines((prev) => prev.filter((l) => l.key !== line.key))
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function LineRow({
  line,
  items,
  fromSiteId,
  excludeTransferId,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  items: Item[];
  fromSiteId: string;
  excludeTransferId?: string;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove?: () => void;
}) {
  const [layers, setLayers] = useState<CostLayer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!line.itemId || !fromSiteId) {
      setLayers(null);
      return;
    }
    setLayers(null);
    getLayerOptions(line.itemId, fromSiteId, excludeTransferId).then((result) => {
      if (!cancelled) setLayers(result);
    });
    return () => {
      cancelled = true;
    };
  }, [line.itemId, fromSiteId, excludeTransferId]);

  const grouped = useMemo(() => (layers ? groupLayersByCost(layers) : []), [layers]);
  const onHand = grouped.reduce((sum, g) => sum + g.qty, 0);
  const qty = Number(line.quantity) || 0;

  // Live preview of what will actually be posted for this line.
  let preview: { text: string; warn: boolean } | null = null;
  if (layers && qty > 0) {
    if (line.choice === "FIFO") {
      const { allocations, shortfall } = consumeLayers(
        layers.map((l) => ({ ...l })),
        qty
      );
      const parts = allocations.map((a) => `${round(a.quantity)} @ ${fmtCost(a.unitCost)}`);
      if (shortfall > 0) parts.push(`${round(shortfall)} beyond recorded stock`);
      preview = { text: `FIFO: ${parts.join(" + ")}`, warn: shortfall > 0 };
    } else {
      const chosen = grouped.find((g) => costKey(g.unitCost) === line.choice);
      const have = chosen?.qty ?? 0;
      preview =
        have + 1e-9 < qty
          ? { text: `Only ${round(have)} available at that cost.`, warn: true }
          : {
              text: `${round(qty)} @ ${fmtCost(chosen?.unitCost ?? null)}`,
              warn: false,
            };
    }
  }

  const choiceMissing =
    line.choice !== "FIFO" &&
    layers != null &&
    !grouped.some((g) => costKey(g.unitCost) === line.choice);

  return (
    <div className="rounded-md border border-gray-200 p-2.5">
      <div className="grid grid-cols-[1fr_90px_auto] gap-2">
        <select
          name="itemId"
          value={line.itemId}
          onChange={(e) => onChange({ itemId: e.target.value, choice: "FIFO" })}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm"
        >
          <option value="">Select item…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          placeholder="Qty"
          value={line.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-2 text-sm"
        />
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-gray-400 hover:text-red-600"
          >
            remove
          </button>
        ) : (
          <span />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Cost</label>
        <select
          name="costChoice"
          value={line.choice}
          onChange={(e) => onChange({ choice: e.target.value })}
          disabled={!line.itemId || !fromSiteId}
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="FIFO">FIFO — oldest stock first (default)</option>
          {grouped.map((g) => (
            <option key={costKey(g.unitCost)} value={costKey(g.unitCost)}>
              {g.unitCost == null ? "No cost on file" : `$${g.unitCost.toFixed(2)}`} ·{" "}
              {round(g.qty)} available · since {fmtDate(g.oldestReceivedAt)}
            </option>
          ))}
          {choiceMissing && (
            <option value={line.choice}>
              {line.choice === "none" ? "No cost on file" : `$${Number(line.choice).toFixed(2)}`}{" "}
              (none currently available)
            </option>
          )}
        </select>
      </div>

      <p className="mt-1.5 text-xs text-gray-500">
        {!line.itemId || !fromSiteId
          ? "Choose a source site and an item to see its cost options."
          : layers == null
            ? "Checking stock…"
            : `On hand at source: ${round(onHand)}`}
        {preview && (
          <span className={preview.warn ? " text-amber-700" : " text-[#134229]"}>
            {" · "}
            {preview.text}
          </span>
        )}
      </p>
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
