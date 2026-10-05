import UploadForm from "./upload-form";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Upload audit findings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Load findings from a tracker tab exported as CSV. Use the tracker&apos;s own
        columns — the file can be a whole tab: if it has a{" "}
        <strong className="font-medium text-gray-700">Discrepancy Found</strong> column,
        only rows marked TRUE become findings and clean audited lines are skipped.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-700">Columns</h2>
        <p className="mt-1 text-sm text-gray-500">
          Required: <code>Date</code>, <code>Facility</code>, <code>Finding Type</code>,{" "}
          <code>Dept. 1</code> and the finding text (<code>Initial Discrepancy Finding</code>).
          Optional: <code>Auditor Initials</code>, <code>Product</code>, <code>Batch</code>,{" "}
          <code>PID</code>, <code>Strain</code>, <code>Qty</code>, <code>Unit</code>,{" "}
          <code>Room</code>, <code>Serial No</code>, <code>Dept. 2</code>, <code>Correction</code>,
          the waste-log columns (<code>Reference #</code>, <code>Weight Disposed (g)</code>,{" "}
          <code>Date of Physical Disposal</code>) and the follow-up columns{" "}
          (<code>Monitoring Action: Teams Notified</code>,{" "}
          <code>Additional Monitoring Action Notes</code>, <code>Resolution Confirmed</code>,{" "}
          <code>Rectified By Dept. Mgr</code>, <code>Resolution Date</code>,{" "}
          <code>Verified By Inventory</code>), which set each finding&apos;s status.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-500">
          <li>
            Facility, department and finding-type names must match the lists in Settings
            (or one of their aliases, like &quot;McDowell - Hub&quot;). Dates can be
            YYYY-MM-DD, M/D/YYYY or M.D.YY.
          </li>
          <li>
            Open findings get the finding type&apos;s default due date counted from the
            audit date.
          </li>
          <li>
            Uploading the same file again is safe: findings already on file are skipped.
          </li>
          <li>
            The limit is 3.8 MB — enough for a whole tracker tab. If a file is larger, export
            just the rows with findings.
          </li>
        </ul>
        <a href="/audit-findings-template.csv" download className="mt-3 inline-block text-sm text-[#134229] hover:underline">
          Download a template CSV
        </a>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <UploadForm />
        </div>
      </div>
    </div>
  );
}
