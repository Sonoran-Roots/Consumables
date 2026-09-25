import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import CategoryEditForm from "./category-edit-form";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: PageProps<"/categories/[id]/edit">) {
  const { id } = await params;

  const [category, categories] = await Promise.all([
    db.category.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!category) notFound();

  return (
    <div className="max-w-md">
      <BackLink href="/categories" label="Back to categories" />
      <h1 className="text-xl font-semibold text-gray-900">Edit category</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <CategoryEditForm
          category={category}
          categories={categories.filter((c) => c.id !== category.id)}
        />
      </div>
    </div>
  );
}
