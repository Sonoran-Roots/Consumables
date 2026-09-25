import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import ItemEditForm from "./item-edit-form";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: PageProps<"/items/[id]/edit">) {
  const { id } = await params;

  const [item, categories, unitsOfMeasure, vendors] = await Promise.all([
    db.item.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.unitOfMeasure.findMany({ orderBy: { code: "asc" } }),
    db.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) notFound();

  return (
    <div className="max-w-xl">
      <BackLink href="/items" label="Back to items" />
      <h1 className="text-xl font-semibold text-gray-900">Edit item</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <ItemEditForm
          item={item}
          categories={categories}
          unitsOfMeasure={unitsOfMeasure}
          vendors={vendors}
        />
      </div>
    </div>
  );
}
