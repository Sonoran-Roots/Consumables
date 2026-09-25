import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import TransferForm from "./transfer-form";

export const dynamic = "force-dynamic";

export default async function NewTransferPage() {
  const [sites, items, employees] = await Promise.all([
    db.site.findMany({ orderBy: { name: "asc" }, include: { book: true } }),
    db.item.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <BackLink href="/transfers" label="Back to transfers" />
      <h1 className="text-xl font-semibold text-gray-900">New transfer</h1>
      <p className="mt-1 text-sm text-gray-500">
        Works across books — pick any two sites, even from different accounting
        books.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <TransferForm sites={sites} items={items} employees={employees} />
      </div>
    </div>
  );
}
