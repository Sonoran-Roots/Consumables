import Link from "next/link";
import { db } from "@/lib/db";
import { deleteCategory } from "./actions";
import DeleteCategoryButton from "./delete-category-button";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: {
      parent: true,
      _count: { select: { items: true, children: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            The consolidated item category taxonomy.
          </p>
        </div>
        <Link
          href="/categories/new"
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New category
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Parent</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">
                Legacy code
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Items</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <Link href={`/categories/${c.id}/edit`} className="hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{c.parent?.name ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-400">
                  {c.legacyCode ?? "—"}
                </td>
                <td className="px-4 py-2 text-gray-600">{c._count.items}</td>
                <td className="px-4 py-2 text-right">
                  <span className="flex items-center justify-end gap-2">
                    <Link
                      href={`/categories/${c.id}/edit`}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      edit
                    </Link>
                    {c._count.items === 0 && c._count.children === 0 ? (
                      <form action={deleteCategory}>
                        <input type="hidden" name="categoryId" value={c.id} />
                        <DeleteCategoryButton categoryName={c.name} />
                      </form>
                    ) : (
                      <span
                        className="text-xs text-gray-300"
                        title="Remove items/subcategories from this category before deleting it"
                      >
                        delete
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No categories yet.{" "}
                  <Link href="/categories/new" className="text-emerald-700 underline">
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
