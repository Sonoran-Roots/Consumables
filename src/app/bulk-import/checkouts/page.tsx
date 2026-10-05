import BackLink from "@/components/back-link";
import BulkUploadForm from "../bulk-upload-form";
import { importCheckoutsCsv } from "./actions";

export const dynamic = "force-dynamic";

export default function BulkImportCheckoutsPage() {
  return (
    <div className="max-w-2xl">
      <BackLink href="/bulk-import" label="Bulk import" />
      <h1 className="text-xl font-semibold text-gray-900">Import check-outs</h1>
      <p className="mt-1 text-sm text-gray-500">
        Load check-outs that already happened — for example the first half of the
        month when onboarding a location mid-month. Each one is recorded on its own
        date, takes stock out of the site, and is attributed to the employee.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">CSV format</h2>
        <p className="mt-1 text-sm text-gray-500">
          One row per item line. Required: <code>date</code> (YYYY-MM-DD),{" "}
          <code>site</code> (name, or code if the name exists in more than one
          book), <code>employee</code> (full name), <code>item</code> (item name or
          SKU) and <code>quantity</code>. Optional: <code>type</code> (checkout or
          return — blank means checkout), <code>purpose</code>,{" "}
          <code>department</code>, <code>notes</code>. Rows with the same date,
          site, employee, type, purpose, department and notes become one check-out
          event.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-500">
          <li>
            <strong className="font-medium text-gray-700">All or nothing:</strong> if
            any row has a problem, nothing is saved, so a corrected file can be
            uploaded again safely.
          </li>
          <li>
            Load <strong className="font-medium text-gray-700">starting balances first</strong>,
            with received dates on or before the earliest check-out — stock has to
            exist before it can be taken out.
          </li>
          <li>Uploading the same file twice records the check-outs twice.</li>
        </ul>
        <a
          href="/checkouts-import-template.csv"
          download
          className="mt-3 inline-block text-sm text-[#134229] hover:underline"
        >
          Download a template CSV
        </a>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <BulkUploadForm action={importCheckoutsCsv} submitLabel="Import check-outs">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="createEmployees" className="mt-0.5" />
              <span>
                Create employees that don&apos;t exist yet — they&apos;re added with no
                PIN or login (they can set a PIN at the kiosk later). Off by default so
                a typo in a name doesn&apos;t create a duplicate person.
              </span>
            </label>
          </BulkUploadForm>
        </div>
      </div>
    </div>
  );
}
