import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import CheckoutEditForm from "./checkout-edit-form";

export const dynamic = "force-dynamic";

export default async function EditCheckoutPage({
  params,
}: PageProps<"/checkouts/[id]/edit">) {
  const { id } = await params;

  const [checkout, sites, items, employees] = await Promise.all([
    db.checkoutEvent.findUnique({ where: { id }, include: { lines: true } }),
    db.site.findMany({ orderBy: { name: "asc" } }),
    db.item.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!checkout) notFound();

  return (
    <div className="max-w-2xl">
      <BackLink href="/checkouts" label="Back to checkouts" />
      <h1 className="text-xl font-semibold text-gray-900">Edit checkout</h1>
      <p className="mt-1 text-sm text-amber-700">
        This already posted to the inventory ledger. Saving changes will
        delete and repost those ledger entries to match your edits.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <CheckoutEditForm
          checkout={checkout}
          sites={sites}
          items={items}
          employees={employees}
        />
      </div>
    </div>
  );
}
