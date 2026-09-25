import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import UnitEditForm from "./unit-edit-form";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({
  params,
}: PageProps<"/units/[id]/edit">) {
  const { id } = await params;

  const unit = await db.unitOfMeasure.findUnique({ where: { id } });
  if (!unit) notFound();

  return (
    <div className="max-w-md">
      <BackLink href="/units" label="Back to units" />
      <h1 className="text-xl font-semibold text-gray-900">Edit unit of measure</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <UnitEditForm unit={unit} />
      </div>
    </div>
  );
}
