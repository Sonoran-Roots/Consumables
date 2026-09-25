import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import ItemForm from "./item-form";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const [categories, unitsOfMeasure] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.unitOfMeasure.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="max-w-xl">
      <BackLink href="/items" label="Back to items" />
      <h1 className="text-xl font-semibold text-gray-900">New item</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every item gets a real, unique identity — no more free-text name matching.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <ItemForm categories={categories} unitsOfMeasure={unitsOfMeasure} />
      </div>
    </div>
  );
}
