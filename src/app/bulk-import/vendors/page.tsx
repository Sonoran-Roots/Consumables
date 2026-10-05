import BackLink from "@/components/back-link";
import BulkUploadForm from "../bulk-upload-form";
import { importVendorsCsv } from "./actions";

export const dynamic = "force-dynamic";

export default function BulkImportVendorsPage() {
  return (
    <div className="max-w-2xl">
      <BackLink href="/bulk-import" label="Bulk import" />
      <h1 className="text-xl font-semibold text-gray-900">Import vendors</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bulk-create the vendor list. Import vendors before items so each item
        can be assigned its default vendor.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">CSV format</h2>
        <p className="mt-1 text-sm text-gray-500">
          Required: <code>name</code>. Optional: <code>isActive</code> (yes/no,
          defaults to yes). Vendors that already exist — compared without regard
          to upper/lower case — are skipped, so it&apos;s safe to re-upload a list.
        </p>
        <a
          href="/vendors-import-template.csv"
          download
          className="mt-3 inline-block text-sm text-[#134229] hover:underline"
        >
          Download a template CSV
        </a>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <BulkUploadForm action={importVendorsCsv} submitLabel="Import vendors" />
        </div>
      </div>
    </div>
  );
}
