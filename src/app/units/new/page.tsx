import BackLink from "@/components/back-link";
import UnitForm from "./unit-form";

export const dynamic = "force-dynamic";

export default function NewUnitPage() {
  return (
    <div className="max-w-md">
      <BackLink href="/units" label="Back to units" />
      <h1 className="text-xl font-semibold text-gray-900">New unit of measure</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <UnitForm />
      </div>
    </div>
  );
}
