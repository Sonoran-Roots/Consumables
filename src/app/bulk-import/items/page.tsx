import BackLink from "@/components/back-link";
import BulkUploadForm from "../bulk-upload-form";
import { importItemsCsv } from "./actions";

export const dynamic = "force-dynamic";

export default function BulkImportItemsPage() {
  return (
    <div className="max-w-2xl">
      <BackLink href="/bulk-import" label="Bulk import" />
      <h1 className="text-xl font-semibold text-gray-900">Import items</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bulk-create the item catalog (or correct existing items). This only
        defines items — it doesn&apos;t add any stock. Load quantities afterwards
        with the starting-balances import.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">CSV format</h2>
        <p className="mt-1 text-sm text-gray-500">
          Required: <code>name</code> (unique — the item&apos;s full display name),{" "}
          <code>category</code> (a category name or one of its legacy aliases) and{" "}
          <code>uom</code> (unit-of-measure code). Optional: <code>materialType</code>{" "}
          (DM/IM/PM/MM/AFS/NA, defaults to NA), <code>brand</code>,{" "}
          <code>genericName</code>, <code>variant</code>, <code>size</code>,{" "}
          <code>specialAttribute</code>, <code>sku</code> (leave blank and one is
          generated, like SKU-000123), <code>legacyId</code>,{" "}
          <code>defaultVendor</code> (must already exist — import vendors first) and{" "}
          <code>isActive</code> (yes/no).
        </p>
        <a
          href="/items-import-template.csv"
          download
          className="mt-3 inline-block text-sm text-[#134229] hover:underline"
        >
          Download a template CSV
        </a>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <BulkUploadForm action={importItemsCsv} submitLabel="Import items">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="updateExisting" className="mt-0.5" />
              <span>
                Update existing items — rows whose name matches an existing item
                change that item&apos;s fields. Blank cells are left as they are,
                never cleared. Without this, existing items are skipped.
              </span>
            </label>
          </BulkUploadForm>
        </div>
      </div>
    </div>
  );
}
