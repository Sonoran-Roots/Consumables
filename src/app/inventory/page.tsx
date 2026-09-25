import { db } from "@/lib/db";
import SiteFilter from "./site-filter";

export default async function InventoryPage({
  searchParams,
}: PageProps<"/inventory">) {
  const { siteId } = await searchParams;
  const selectedSiteId = typeof siteId === "string" ? siteId : undefined;

  const sites = await db.site.findMany({
    orderBy: { name: "asc" },
    include: { book: true },
  });

  const grouped = await db.inventoryTransaction.groupBy({
    by: ["itemId", "siteId"],
    _sum: { quantity: true },
    where: selectedSiteId ? { siteId: selectedSiteId } : undefined,
  });

  const nonZero = grouped.filter((g) => (g._sum.quantity ?? 0) !== 0);

  const [items, siteMap] = await Promise.all([
    db.item.findMany({
      where: { id: { in: nonZero.map((g) => g.itemId) } },
      include: { category: true, defaultUom: true },
    }),
    db.site.findMany({
      where: { id: { in: nonZero.map((g) => g.siteId) } },
    }),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const siteById = new Map(siteMap.map((s) => [s.id, s]));

  const rows = nonZero
    .map((g) => ({
      item: itemMap.get(g.itemId)!,
      site: siteById.get(g.siteId)!,
      onHand: g._sum.quantity ?? 0,
    }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Current inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            One authoritative on-hand number per item/site, computed live from the
            transaction ledger.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SiteFilter sites={sites} selectedSiteId={selectedSiteId} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Item</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Site</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Category
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">
                On hand
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">UOM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={`${row.item.id}-${row.site.id}`}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  {row.item.name}
                </td>
                <td className="px-4 py-2 text-gray-600">{row.site.name}</td>
                <td className="px-4 py-2 text-gray-600">{row.item.category.name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                  {row.onHand}
                </td>
                <td className="px-4 py-2 text-gray-600">{row.item.defaultUom.code}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No inventory activity recorded yet. Once purchases, transfers, or
                  counts are entered, on-hand balances will show up here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
