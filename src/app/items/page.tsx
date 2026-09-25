import Link from "next/link";
import { db } from "@/lib/db";
import { setItemActive } from "./actions";
import RetireButton from "./retire-button";

export const dynamic = "force-dynamic";

type StatusFilter = "active" | "inactive" | "all";

function isStatusFilter(value: string): value is StatusFilter {
  return value === "active" || value === "inactive" || value === "all";
}

export default async function ItemsPage({
  searchParams,
}: PageProps<"/items">) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status: StatusFilter = rawStatus && isStatusFilter(rawStatus) ? rawStatus : "active";

  const items = await db.item.findMany({
    where: status === "all" ? undefined : { isActive: status === "active" },
    orderBy: { name: "asc" },
    include: { category: true, defaultUom: true, defaultVendor: true },
  });

  const onHandRows = await db.inventoryTransaction.groupBy({
    by: ["itemId"],
    where: { itemId: { in: items.map((i) => i.id) } },
    _sum: { quantity: true },
  });
  const onHandMap = new Map(onHandRows.map((r) => [r.itemId, r._sum.quantity ?? 0]));

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Items</h1>
          <p className="mt-1 text-sm text-gray-500">
            The item master — every item is tracked by a real ID, not a free-text name.
          </p>
        </div>
        <Link
          href="/items/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New item
        </Link>
      </div>

      <div className="mt-4 flex gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/items?status=${tab.key}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === tab.key
                ? "bg-emerald-100 text-emerald-900"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Category</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">UOM</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Material type
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Default vendor
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">SKU</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">
                On-hand (all sites)
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const onHand = onHandMap.get(item.id) ?? 0;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link href={`/items/${item.id}/edit`} className="hover:underline">
                      {item.name}
                    </Link>
                    {!item.isActive && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        retired
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{item.category.name}</td>
                  <td className="px-4 py-2 text-gray-600">{item.defaultUom.code}</td>
                  <td className="px-4 py-2 text-gray-600">{item.materialType}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {item.defaultVendor?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-400">
                    {item.sku ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {onHand}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="flex items-center justify-end gap-2">
                      <Link
                        href={`/items/${item.id}/edit`}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        edit
                      </Link>
                      {item.isActive ? (
                        onHand === 0 ? (
                          <form action={setItemActive}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="isActive" value="false" />
                            <RetireButton itemName={item.name} />
                          </form>
                        ) : (
                          <span
                            className="text-xs text-gray-300"
                            title="On-hand inventory exists at one or more sites — it must reach zero everywhere before this item can be retired"
                          >
                            retire
                          </span>
                        )
                      ) : (
                        <form action={setItemActive}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="isActive" value="true" />
                          <button
                            type="submit"
                            className="text-xs text-emerald-700 hover:underline"
                          >
                            reactivate
                          </button>
                        </form>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  {status === "active"
                    ? "No active items."
                    : status === "inactive"
                      ? "No retired items."
                      : "No items yet."}{" "}
                  <Link href="/items/new" className="text-emerald-700 underline">
                    Add one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
