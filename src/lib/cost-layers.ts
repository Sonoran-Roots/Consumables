import { db } from "@/lib/db";
import {
  consumeLayers,
  costKey,
  groupLayersByCost,
  type CostLayer,
} from "@/lib/cost-allocation";

const EPS = 1e-9;

// Rebuilds the cost layers still sitting at a site for one item by replaying
// its ledger in order — no separate layer table to keep in sync. Every
// inflow starts a layer at its recorded unit cost (PO receipts carry the PO
// cost; transfers-in carry the cost they left the source with; opening
// balances usually have none). Every outflow takes from the oldest layer
// (FIFO) — except a transfer-out that recorded a specific cost, which takes
// from that cost's layers first (that's the "move this specific priced
// batch" case).
//
// `excludeTransferId` replays as if that transfer had never posted, so
// editing an already-received transfer sees the stock it's about to redo.
export async function getCostLayers(
  itemId: string,
  siteId: string,
  opts: { excludeTransferId?: string } = {}
): Promise<CostLayer[]> {
  const txns = await db.inventoryTransaction.findMany({
    where: {
      itemId,
      siteId,
      ...(opts.excludeTransferId
        ? { OR: [{ transferId: null }, { transferId: { not: opts.excludeTransferId } }] }
        : {}),
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    select: { type: true, quantity: true, unitCost: true, occurredAt: true },
  });

  const layers: CostLayer[] = [];
  let lastConsumedCost: number | null = null;

  for (const t of txns) {
    if (t.quantity > EPS) {
      // Returns/positive adjustments carry no cost of their own — put them
      // back at the cost of what was most recently taken out.
      const cost =
        t.unitCost ??
        (t.type === "CHECKOUT_RETURN" || t.type === "DISCREPANCY" ? lastConsumedCost : null);
      layers.push({ unitCost: cost, qty: t.quantity, receivedAt: t.occurredAt.toISOString() });
    } else if (t.quantity < -EPS) {
      const prefer =
        t.type === "TRANSFER_OUT" && t.unitCost != null ? costKey(t.unitCost) : undefined;
      const { allocations } = consumeLayers(layers, -t.quantity, prefer);
      if (allocations.length > 0) {
        lastConsumedCost = allocations[allocations.length - 1].unitCost;
      }
    }
  }

  return layers;
}

export type TransferLineRequest = {
  itemId: string;
  quantity: number;
  // "FIFO" (default) or the costKey of a specific layer to draw from.
  choice: string;
};

export type ResolvedTransferLine = {
  itemId: string;
  quantity: number;
  unitCost: number | null;
};

// Turns what someone entered on the transfer form (item, qty, and either
// "FIFO" or a chosen cost layer) into the actual priced transfer lines. A
// FIFO line that spans two cost layers becomes two lines, one per cost, so
// each carries a single accurate unit cost. Costs are never typed in — they
// only ever come from layers. Runs on the server at save time so the result
// reflects stock right now, not whatever the form was showing.
export async function resolveTransferLines(
  fromSiteId: string,
  requests: TransferLineRequest[],
  opts: { excludeTransferId?: string } = {}
): Promise<{ ok: true; lines: ResolvedTransferLine[] } | { ok: false; error: string }> {
  // One working copy of each item's layers, shared across lines so two lines
  // for the same item don't both claim the same stock.
  const working = new Map<string, CostLayer[]>();
  const lines: ResolvedTransferLine[] = [];

  for (const req of requests) {
    let layers = working.get(req.itemId);
    if (!layers) {
      layers = await getCostLayers(req.itemId, fromSiteId, opts);
      working.set(req.itemId, layers);
    }

    if (req.choice === "FIFO" || req.choice === "") {
      const { allocations, shortfall } = consumeLayers(layers, req.quantity);
      for (const a of allocations) {
        lines.push({ itemId: req.itemId, quantity: a.quantity, unitCost: a.unitCost });
      }
      // Source is short on recorded stock — still transferable (same as
      // before), just with nothing to price the overage from.
      if (shortfall > 0) {
        lines.push({ itemId: req.itemId, quantity: shortfall, unitCost: null });
      }
      continue;
    }

    const available = groupLayersByCost(layers).find((g) => costKey(g.unitCost) === req.choice);
    const availableQty = available?.qty ?? 0;
    if (availableQty + EPS < req.quantity) {
      const item = await db.item.findUnique({ where: { id: req.itemId }, select: { name: true } });
      const label = req.choice === "none" ? "no cost on file" : `$${Number(req.choice).toFixed(2)}`;
      return {
        ok: false,
        error: `Only ${Math.round(availableQty * 1000) / 1000} of ${item?.name ?? "that item"} available at ${label} — choose FIFO or lower the quantity.`,
      };
    }
    const { allocations } = consumeLayers(layers, req.quantity, req.choice);
    for (const a of allocations) {
      lines.push({ itemId: req.itemId, quantity: a.quantity, unitCost: a.unitCost });
    }
  }

  return { ok: true, lines };
}
