import BackLink from "@/components/back-link";
import VendorForm from "./vendor-form";

export const dynamic = "force-dynamic";

export default function NewVendorPage() {
  return (
    <div className="max-w-md">
      <BackLink href="/vendors" label="Back to vendors" />
      <h1 className="text-xl font-semibold text-gray-900">New vendor</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <VendorForm />
      </div>
    </div>
  );
}
