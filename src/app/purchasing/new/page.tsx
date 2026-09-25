import Link from "next/link";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import PurchaseOrderForm from "./po-form";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const [sites, vendors, items] = await Promise.all([
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
    db.vendor.findMany({ orderBy: { name: "asc" }, where: { isActive: true } }),
    db.item.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <BackLink href="/purchasing" label="Back to purchase orders" />
      <h1 className="text-xl font-semibold text-gray-900">New purchase order</h1>
      <p className="mt-1 text-sm text-gray-500">
        Build it out like an invoice — add every item, quantity, and cost.
      </p>

      {vendors.length === 0 && (
        <p className="mt-2 text-sm text-amber-700">
          No vendors yet —{" "}
          <Link href="/vendors/new" className="underline">
            add one first
          </Link>
          .
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <PurchaseOrderForm sites={sites} vendors={vendors} items={items} />
      </div>
    </div>
  );
}
