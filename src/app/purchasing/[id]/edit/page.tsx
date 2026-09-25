import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import PurchaseOrderEditForm from "./po-edit-form";

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({
  params,
}: PageProps<"/purchasing/[id]/edit">) {
  const { id } = await params;

  const [po, sites, vendors, items] = await Promise.all([
    db.purchaseOrder.findUnique({
      where: { id },
      include: { lines: { include: { inventoryTransactions: true } } },
    }),
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
    db.vendor.findMany({ orderBy: { name: "asc" } }),
    db.item.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!po) notFound();

  const anyReceived = po.lines.some((l) => l.inventoryTransactions.length > 0);

  return (
    <div className="max-w-2xl">
      <BackLink href={`/purchasing/${po.id}`} label="Back to purchase order" />
      <h1 className="text-xl font-semibold text-gray-900">Edit PO {po.poNumber}</h1>
      {anyReceived && (
        <p className="mt-1 text-sm text-amber-700">
          Some lines already have deliveries posted to the inventory ledger.
          Changing a line&apos;s item or unit cost updates those posted
          transactions to match; removing a line deletes its posted
          deliveries entirely. Quantities already received are left as-is.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <PurchaseOrderEditForm po={po} sites={sites} vendors={vendors} items={items} />
      </div>
    </div>
  );
}
