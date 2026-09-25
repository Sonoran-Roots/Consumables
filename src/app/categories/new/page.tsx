import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import CategoryForm from "./category-form";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-md">
      <BackLink href="/categories" label="Back to categories" />
      <h1 className="text-xl font-semibold text-gray-900">New category</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <CategoryForm categories={categories} />
      </div>
    </div>
  );
}
