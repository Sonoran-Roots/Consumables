import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import ReconciliationForm from "./reconciliation-form";

export const dynamic = "force-dynamic";

export default async function NewReconciliationPage() {
  const sites = await db.site.findMany({
    orderBy: { name: "asc" },
    include: { book: true },
  });

  return (
    <div className="max-w-md">
      <BackLink href="/reconciliation" label="Back to reconciliation" />
      <h1 className="text-xl font-semibold text-gray-900">New reconciliation</h1>
      <p className="mt-1 text-sm text-gray-500">
        Snapshots ending quantities, transfer costs, and usage for every item
        touched at the site during the period, computed live from the ledger.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <ReconciliationForm sites={sites} />
      </div>
    </div>
  );
}
