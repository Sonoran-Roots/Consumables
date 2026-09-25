import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import CheckoutForm from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function NewCheckoutPage() {
  const [sites, items, employees] = await Promise.all([
    db.site.findMany({ orderBy: { name: "asc" } }),
    db.item.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <BackLink href="/checkouts" label="Back to checkouts" />
      <h1 className="text-xl font-semibold text-gray-900">New checkout</h1>
      <p className="mt-1 text-sm text-gray-500">
        Record items taken out (or returned) by an employee at a site.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <CheckoutForm sites={sites} items={items} employees={employees} />
      </div>
    </div>
  );
}
