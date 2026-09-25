import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import { consumptionDelta } from "@/lib/reconciliation-compute";
import ParLevelCalculator from "./par-level-calculator";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(d: Date) {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - day);
  return copy;
}

const TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening balance",
  PURCHASE: "Purchase",
  SALE: "Sale",
  SALE_OUT_OF_STATE: "Sale (out of state)",
  PRODUCTION: "Production",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  DISCREPANCY: "Audit discrepancy",
  CHECKOUT: "Checkout",
  CHECKOUT_RETURN: "Checkout return",
  DAMAGED: "Damaged",
};

function sourceLink(t: {
  transferId: string | null;
  checkoutEventId: string | null;
  purchaseOrderId: string | null;
  auditId: string | null;
}) {
  if (t.transferId) return { href: `/transfers/${t.transferId}`, label: "View transfer" };
  if (t.checkoutEventId)
    return { href: `/checkouts/${t.checkoutEventId}/edit`, label: "View checkout" };
  if (t.purchaseOrderId) return { href: `/purchasing/${t.purchaseOrderId}`, label: "View PO" };
  if (t.auditId) return { href: `/audits/${t.auditId}`, label: "View audit" };
  return null;
}

export default async function ItemInventoryDetailPage({
  params,
  searchParams,
}: PageProps<"/inventory/[itemId]">) {
  const { itemId } = await params;
  const { site: siteIdRaw } = await searchParams;
  const siteId = typeof siteIdRaw === "string" ? siteIdRaw : undefined;

  const item = await db.item.findUnique({
    where: { id: itemId },
    include: { category: true, defaultUom: true, defaultVendor: true },
  });
  if (!item) notFound();

  const [bySite, sites, history, consumptionTx, onHandAtSiteAgg] = await Promise.all([
    db.inventoryTransaction.groupBy({
      by: ["siteId"],
      where: { itemId },
      _sum: { quantity: true },
    }),
    db.site.findMany({ orderBy: { name: "asc" } }),
    siteId
      ? db.inventoryTransaction.findMany({
          where: { itemId, siteId },
          orderBy: { occurredAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    siteId
      ? db.inventoryTransaction.findMany({
          where: {
            itemId,
            siteId,
            type: {
              in: [
                "SALE",
                "SALE_OUT_OF_STATE",
                "CHECKOUT",
                "CHECKOUT_RETURN",
                "DAMAGED",
                "DISCREPANCY",
              ],
            },
          },
          orderBy: { occurredAt: "asc" },
          select: { occurredAt: true, type: true, quantity: true },
        })
      : Promise.resolve([]),
    siteId
      ? db.inventoryTransaction.aggregate({
          where: { itemId, siteId },
          _sum: { quantity: true },
        })
      : Promise.resolve(null),
  ]);

  const siteById = new Map(sites.map((s) => [s.id, s]));
  const onHandRows = bySite
    .map((g) => ({
      site: siteById.get(g.siteId),
      onHand: g._sum.quantity ?? 0,
    }))
    .filter((r) => r.site && r.onHand !== 0)
    .sort((a, b) => b.onHand - a.onHand);

  const totalOnHand = onHandRows.reduce((sum, r) => sum + r.onHand, 0);
  const selectedSite = siteId ? siteById.get(siteId) : undefined;
  const onHandAtSite = onHandAtSiteAgg?._sum.quantity ?? 0;

  const now = new Date();
  const earliest = consumptionTx[0]?.occurredAt;
  const daysOfHistory = earliest
    ? Math.max(Math.round((now.getTime() - earliest.getTime()) / DAY_MS), 1)
    : 0;
  const totalConsumed = consumptionTx.reduce(
    (sum, t) => sum + consumptionDelta(t.type, t.quantity),
    0
  );
  const allTimeAvgPerDay = daysOfHistory > 0 ? totalConsumed / daysOfHistory : 0;

  const windows = [7, 30, 90].map((days) => {
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const total = consumptionTx
      .filter((t) => t.occurredAt >= cutoff)
      .reduce((sum, t) => sum + consumptionDelta(t.type, t.quantity), 0);
    return { days, total, perDay: total / days };
  });

  const weeklyMap = new Map<number, number>();
  for (const t of consumptionTx) {
    const weekStart = startOfWeek(t.occurredAt).getTime();
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + consumptionDelta(t.type, t.quantity));
  }
  const twelveWeeksAgo = startOfWeek(new Date(now.getTime() - 11 * 7 * DAY_MS)).getTime();
  const weeks: { label: string; total: number }[] = [];
  for (let w = twelveWeeksAgo; w <= startOfWeek(now).getTime(); w += 7 * DAY_MS) {
    weeks.push({
      label: new Date(w).toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
        timeZone: "UTC",
      }),
      total: weeklyMap.get(w) ?? 0,
    });
  }
  const maxWeekly = Math.max(1, ...weeks.map((w) => w.total));

  return (
    <div className="max-w-4xl space-y-6">
      <BackLink href="/inventory" label="Back to current inventory" />

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{item.name}</h1>
          <Link
            href={`/items/${item.id}/edit`}
            className="text-xs text-emerald-700 hover:underline"
          >
            edit item
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {item.category.name} · {item.defaultUom.code}
          {item.defaultVendor ? ` · ${item.defaultVendor.name}` : ""}
          {item.sku ? ` · SKU ${item.sku}` : ""}
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Item details</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Brand</dt>
            <dd className="text-gray-900">{item.brand ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Generic name</dt>
            <dd className="text-gray-900">{item.genericName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Variant</dt>
            <dd className="text-gray-900">{item.variant ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Size</dt>
            <dd className="text-gray-900">{item.size ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Material type</dt>
            <dd className="text-gray-900">{item.materialType}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900">{item.isActive ? "Active" : "Retired"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            Current inventory by site
          </h2>
          <span className="text-sm text-gray-500">
            Total on hand: <span className="font-medium text-gray-900">{totalOnHand}</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Tap a site to see this item&apos;s history there — useful for
          spotting when a transfer would even things out.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="py-1.5 pr-3 text-left font-medium text-gray-500">Site</th>
                <th className="py-1.5 text-right font-medium text-gray-500">On hand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {onHandRows.map((row) => (
                <tr
                  key={row.site!.id}
                  className={row.site!.id === siteId ? "bg-emerald-50" : undefined}
                >
                  <td className="py-1.5 pr-3">
                    <Link
                      href={`/inventory/${item.id}?site=${row.site!.id}`}
                      className={`hover:underline ${
                        row.site!.id === siteId
                          ? "font-medium text-emerald-800"
                          : "text-gray-900"
                      }`}
                    >
                      {row.site!.name}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">
                    {row.onHand}
                  </td>
                </tr>
              ))}
              {onHandRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-gray-400">
                    No on-hand inventory for this item anywhere.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">
          {selectedSite
            ? `History at ${selectedSite.name}`
            : "History"}
        </h2>
        {!selectedSite && (
          <p className="mt-2 text-sm text-gray-400">
            Pick a site above (or from the inventory list) to see this item&apos;s
            transaction history there.
          </p>
        )}
        {selectedSite && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr>
                  <th className="py-1.5 pr-3 text-left font-medium text-gray-500">Date</th>
                  <th className="py-1.5 pr-3 text-left font-medium text-gray-500">Type</th>
                  <th className="py-1.5 pr-3 text-right font-medium text-gray-500">Qty</th>
                  <th className="py-1.5 pr-3 text-right font-medium text-gray-500">
                    Unit cost
                  </th>
                  <th className="py-1.5 pr-3 text-left font-medium text-gray-500">Notes</th>
                  <th className="py-1.5 text-left font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((t) => {
                  const link = sourceLink(t);
                  return (
                    <tr key={t.id}>
                      <td className="py-1.5 pr-3 text-gray-600">
                        {t.occurredAt.toLocaleString()}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-900">
                        {TYPE_LABELS[t.type] ?? t.type}
                      </td>
                      <td
                        className={`py-1.5 pr-3 text-right tabular-nums font-medium ${
                          t.quantity > 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">
                        {t.unitCost != null ? `$${t.unitCost.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-500">{t.notes ?? "—"}</td>
                      <td className="py-1.5">
                        {link && (
                          <Link
                            href={link.href}
                            className="text-xs text-emerald-700 hover:underline"
                          >
                            {link.label}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      No transaction history for this item at {selectedSite.name}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSite && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-700">
            Utilization &amp; par level at {selectedSite.name}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Based on sales, net checkouts, damage, and audit discrepancies
            (used or missing inventory) recorded at this site.{" "}
            {daysOfHistory > 0
              ? `Covers ${daysOfHistory} day${daysOfHistory === 1 ? "" : "s"} of history.`
              : "No usage history recorded here yet."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {windows.map((w) => (
              <div key={w.days} className="rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Last {w.days} days</div>
                <div className="text-lg font-semibold text-gray-900">{w.total}</div>
                <div className="text-xs text-gray-500">{w.perDay.toFixed(2)}/day</div>
              </div>
            ))}
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">All-time avg</div>
              <div className="text-lg font-semibold text-gray-900">
                {allTimeAvgPerDay.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">per day</div>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-gray-500">
              Weekly usage (last 12 weeks)
            </p>
            <div className="flex h-24 items-end gap-1">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  title={`Week of ${w.label}: ${w.total}`}
                  className="flex-1 rounded-t bg-emerald-200"
                  style={{ height: `${Math.max((w.total / maxWeekly) * 100, w.total > 0 ? 4 : 1)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-400">
              <span>{weeks[0]?.label}</span>
              <span>{weeks[weeks.length - 1]?.label}</span>
            </div>
          </div>

          <ParLevelCalculator
            avgDailyUsage={allTimeAvgPerDay}
            currentOnHand={onHandAtSite}
            daysOfHistory={daysOfHistory}
          />
        </section>
      )}
    </div>
  );
}
