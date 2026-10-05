import { notFound } from "next/navigation";
import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/ia/options";
import { toDateInput } from "@/lib/ia/dates";
import FindingForm, { type FindingFormValues } from "../../_components/finding-form";
import { updateFinding } from "../../findings/actions";

export const dynamic = "force-dynamic";

export default async function EditFindingPage({ params }: PageProps<"/inventory-audit/edit/[id]">) {
  const { id } = await params;
  const [f, opts] = await Promise.all([db.iaFinding.findUnique({ where: { id } }), getFormOptions()]);
  if (!f) notFound();

  const s = (v: string | number | null) => (v == null ? "" : String(v));
  const initial: FindingFormValues = {
    findingId: f.id, auditType: f.auditType, auditDate: toDateInput(f.auditDate), auditors: s(f.auditors),
    facilityId: f.facilityId, findingTypeId: f.findingTypeId, categoryId: s(f.categoryId), departmentId: f.departmentId, secondDepartmentId: s(f.secondDepartmentId),
    description: f.description, product: s(f.product), batchId: s(f.batchId), pid: s(f.pid), strain: s(f.strain),
    quantity: s(f.quantity), unit: s(f.unit), room: s(f.room), serialNo: s(f.serialNo), reference: s(f.reference),
    weightGrams: s(f.weightGrams), disposalDate: toDateInput(f.disposalDate), correction: s(f.correction),
    monitoringNotes: s(f.monitoringNotes), dueDate: toDateInput(f.dueDate), assignedToId: s(f.assignedToId),
  };

  return (
    <div className="max-w-3xl">
      <BackLink href={`/inventory-audit/findings/${f.id}`} label="Back to finding" />
      <h1 className="text-xl font-semibold text-gray-900">Edit finding</h1>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <FindingForm
          action={updateFinding}
          initial={initial}
          facilities={opts.facilities}
          departments={opts.departments}
          types={opts.types}
          categories={opts.categories}
          assignees={opts.assignees}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
