import Link from "next/link";
import BackLink from "@/components/back-link";
import BulkUploadForm from "../bulk-upload-form";
import { importInventoryCsv } from "./actions";

export const dynamic = "force-dynamic";

export default function BulkImportInventoryPage() {
  return (
    <div className="max-w-2xl">
      <BackLink href="/bulk-import" label="Bulk import" />
      <h1 className="text-xl font-semibold text-gray-900">Import starting balances</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bulk-load on-hand quantities per site. This posts an{" "}
        <span className="font-mono text-xs">OPENING_BALANCE</span> ledger entry for
        each row — it doesn&apos;t touch historical data. Each row is one cost lot:
        to load several lots of one item at one site, give each lot its own row.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">CSV format</h2>
        <p className="mt-1 text-sm text-gray-500">
          Required columns: <code>itemName</code>, <code>site</code> (site name or
          code — use the code if the name exists in more than one book, like
          &quot;The Highway&quot;), <code>quantity</code>. If the item doesn&apos;t
          already exist, <code>category</code> and <code>uom</code> are also
          required so it can be created. Optional: <code>brand</code>,{" "}
          <code>genericName</code>, <code>variant</code>, <code>size</code>,{" "}
          <code>materialType</code> (DM/IM/PM/MM/AFS/NA, defaults to NA),{" "}
          <code>sku</code>, <code>unitCost</code>, <code>notes</code>,{" "}
          <code>specialAttribute</code>, <code>legacyId</code>, <code>vendor</code>{" "}
          (created if new; a new item&apos;s default vendor is the vendor of its
          most recent lot), and <code>receivedDate</code> (YYYY-MM-DD — sets the
          lot&apos;s age for FIFO costing).
        </p>
        <a
          href="/import-template.csv"
          download
          className="mt-3 inline-block text-sm text-[#134229] hover:underline"
        >
          Download a template CSV
        </a>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <BulkUploadForm action={importInventoryCsv} submitLabel="Import" />
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Once imported, check the numbers on the{" "}
        <Link href="/inventory" className="text-[#134229] underline">
          Inventory
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
