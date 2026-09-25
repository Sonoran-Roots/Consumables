import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const items = await db.item.findMany({
    orderBy: { name: "asc" },
    include: { category: true, defaultUom: true, defaultVendor: true },
  });

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

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-2 text-gray-600">{item.category.name}</td>
                <td className="px-4 py-2 text-gray-600">{item.defaultUom.code}</td>
                <td className="px-4 py-2 text-gray-600">{item.materialType}</td>
                <td className="px-4 py-2 text-gray-600">
                  {item.defaultVendor?.name ?? "—"}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-400">
                  {item.sku ?? "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No items yet.{" "}
                  <Link href="/items/new" className="text-emerald-700 underline">
                    Add the first one
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
