// Pure FIFO / specific-layer cost math — no database access, so it's shared
// by the server (which decides what actually gets posted) and the transfer
// form (which previews it). See cost-layers.ts for how layers are built.
//
// A "layer" is stock that arrived at one site at one unit cost. Costs only
// ever enter the system on a PO receipt (or a legacy opening balance, which
// has none); transfers, checkouts etc. just consume layers and carry the
// cost along, so the same cost follows the item wherever it goes.

export type CostLayer = {
  unitCost: number | null; // null = no cost on file (e.g. legacy opening balance)
  qty: number;
  receivedAt: string; // ISO — layers are kept oldest-first
};

export type Allocation = { unitCost: number | null; quantity: number };

const EPS = 1e-9;

// Floats round-trip through the DB, so compare costs by a normalised key.
export function costKey(cost: number | null): string {
  return cost == null ? "none" : String(Math.round(cost * 1e6) / 1e6);
}

// Takes `quantity` out of `layers` (mutating it — pass a copy to preview).
// Layers whose cost matches `preferKey` go first, then plain FIFO. Returns
// what was taken, merged by cost, plus any shortfall (quantity the layers
// couldn't cover, i.e. the site is short on recorded stock).
export function consumeLayers(
  layers: CostLayer[],
  quantity: number,
  preferKey?: string
): { allocations: Allocation[]; shortfall: number } {
  const taken = new Map<string, Allocation>();
  let remaining = quantity;

  function drain(match: (l: CostLayer) => boolean) {
    for (const layer of layers) {
      if (remaining <= EPS) return;
      if (layer.qty <= EPS || !match(layer)) continue;
      const take = Math.min(layer.qty, remaining);
      layer.qty -= take;
      remaining -= take;
      const key = costKey(layer.unitCost);
      const existing = taken.get(key);
      if (existing) existing.quantity += take;
      else taken.set(key, { unitCost: layer.unitCost, quantity: take });
    }
  }

  if (preferKey !== undefined) drain((l) => costKey(l.unitCost) === preferKey);
  drain(() => true);

  // Drop emptied layers so callers see only what's left.
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].qty <= EPS) layers.splice(i, 1);
  }

  return {
    allocations: [...taken.values()],
    shortfall: remaining > EPS ? remaining : 0,
  };
}

export type GroupedLayer = {
  unitCost: number | null;
  qty: number;
  oldestReceivedAt: string;
};

// Layers collapsed to one row per distinct cost — what a person picks from.
// Ordered by the oldest arrival at each cost, so the first row is the FIFO one.
export function groupLayersByCost(layers: CostLayer[]): GroupedLayer[] {
  const groups = new Map<string, GroupedLayer>();
  for (const l of layers) {
    if (l.qty <= EPS) continue;
    const key = costKey(l.unitCost);
    const g = groups.get(key);
    if (g) {
      g.qty += l.qty;
      if (l.receivedAt < g.oldestReceivedAt) g.oldestReceivedAt = l.receivedAt;
    } else {
      groups.set(key, { unitCost: l.unitCost, qty: l.qty, oldestReceivedAt: l.receivedAt });
    }
  }
  return [...groups.values()].sort((a, b) => a.oldestReceivedAt.localeCompare(b.oldestReceivedAt));
}

export function fmtCost(cost: number | null): string {
  return cost == null ? "no cost on file" : `$${cost.toFixed(2)}`;
}
