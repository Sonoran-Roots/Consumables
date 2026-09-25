import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import ReconciliationEditForm from "./reconciliation-edit-form";

export const dynamic = "force-dynamic";

export default async function EditReconciliationPage({
  params,
}: PageProps<"/reconciliation/[id]/edit">) {
  const { id } = await params;

  const [reconciliation, sites] = await Promise.all([
    db.inventoryReconciliation.findUnique({ where: { id } }),
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
  ]);

  if (!reconciliation) notFound();

  return (
    <div className="max-w-md">
      <BackLink href={`/reconciliation/${reconciliation.id}`} label="Back to reconciliation" />
      <h1 className="text-xl font-semibold text-gray-900">Edit reconciliation</h1>
      {reconciliation.status === "CLOSED" ? (
        <p className="mt-1 text-sm text-amber-700">
          This is closed — notes can still be edited below, but reopen it
          from the detail page first to change its site or period.
        </p>
      ) : (
        <p className="mt-1 text-sm text-gray-500">
          Changing the site or period recomputes every line from the ledger.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <ReconciliationEditForm reconciliation={reconciliation} sites={sites} />
      </div>
    </div>
  );
}
