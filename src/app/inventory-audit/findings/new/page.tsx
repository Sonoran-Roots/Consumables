import BackLink from "@/components/back-link";
import { getFormOptions } from "@/lib/ia/options";
import FindingForm, { EMPTY_FINDING } from "../../_components/finding-form";
import { createFinding } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewFindingPage() {
  const opts = await getFormOptions();
  return (
    <div className="max-w-3xl">
      <BackLink href="/inventory-audit/findings" label="Findings" />
      <h1 className="text-xl font-semibold text-gray-900">Add a finding</h1>
      <p className="mt-1 text-sm text-gray-500">
        Log one discrepancy. To load many at once from the tracker, use Upload instead.
      </p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <FindingForm
          action={createFinding}
          initial={{ ...EMPTY_FINDING, auditDate: new Date().toISOString().slice(0, 10) }}
          facilities={opts.facilities}
          departments={opts.departments}
          types={opts.types}
          categories={opts.categories}
          assignees={opts.assignees}
          submitLabel="Log finding"
        />
      </div>
    </div>
  );
}
