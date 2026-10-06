import BackLink from "@/components/back-link";
import { getFormOptions } from "@/lib/ia/options";
import NewAuditForm from "./new-audit-form";

export const dynamic = "force-dynamic";
// Loading a large audit file (about 11,000 lines for the biggest tracker tab) takes a few seconds.
export const maxDuration = 60;

export default async function NewAuditPage() {
  const opts = await getFormOptions();
  return (
    <div className="max-w-2xl">
      <BackLink href="/inventory-audit/audits" label="Audits" />
      <h1 className="text-xl font-semibold text-gray-900">Start an audit</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload the list of lines to count — for example the Dutchie export or a room tab from the tracker.
        Every line starts as <strong className="font-medium text-gray-700">Pending</strong>, and your team then counts
        them one by one.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">What the file needs</h2>
        <p className="mt-1 text-sm text-gray-500">
          A header row, then one row per line. Recognised columns: <code>Product</code>, <code>Batch</code>,{" "}
          <code>PID</code>, <code>Strain</code>, <code>Room</code>, <code>Serial No</code> (or <code>Tags</code>),{" "}
          <code>Unit</code> / <code>Type</code>, <code>Category</code>, and the system count (<code>Qty (Inc. allocated)</code>,{" "}
          <code>Count</code>, <code>Dutchie</code> or <code>Available</code>). A title row above the headers, repeated
          header rows and month or section headings are skipped automatically.
        </p>
        <a href="/audit-lines-template.csv" download className="mt-2 inline-block text-sm text-[#134229] hover:underline">
          Download a template CSV
        </a>
        <div className="mt-6 border-t border-gray-100 pt-6">
          <NewAuditForm
            facilities={opts.facilities}
            departments={opts.departments}
            today={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>
    </div>
  );
}
