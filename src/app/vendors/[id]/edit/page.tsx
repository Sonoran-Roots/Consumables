import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import VendorEditForm from "./vendor-edit-form";

export const dynamic = "force-dynamic";

export default async function EditVendorPage({
  params,
}: PageProps<"/vendors/[id]/edit">) {
  const { id } = await params;

  const vendor = await db.vendor.findUnique({ where: { id } });
  if (!vendor) notFound();

  return (
    <div className="max-w-md">
      <BackLink href="/vendors" label="Back to vendors" />
      <h1 className="text-xl font-semibold text-gray-900">Edit vendor</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <VendorEditForm vendor={vendor} />
      </div>
    </div>
  );
}
