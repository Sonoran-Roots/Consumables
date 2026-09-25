import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import TransferEditForm from "./transfer-edit-form";

export const dynamic = "force-dynamic";

export default async function EditTransferPage({
  params,
}: PageProps<"/transfers/[id]/edit">) {
  const { id } = await params;

  const [transfer, sites, items, employees] = await Promise.all([
    db.transfer.findUnique({ where: { id }, include: { lines: true } }),
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
    db.item.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!transfer) notFound();

  return (
    <div className="max-w-2xl">
      <BackLink href={`/transfers/${transfer.id}`} label="Back to transfer" />
      <h1 className="text-xl font-semibold text-gray-900">Edit transfer</h1>
      {transfer.status === "RECEIVED" && (
        <p className="mt-1 text-sm text-amber-700">
          This transfer already posted to the inventory ledger. Saving changes
          will delete and repost those ledger entries to match your edits.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <TransferEditForm
          transfer={transfer}
          sites={sites}
          items={items}
          employees={employees}
        />
      </div>
    </div>
  );
}
