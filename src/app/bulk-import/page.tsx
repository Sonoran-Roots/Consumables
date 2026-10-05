import Link from "next/link";

export const dynamic = "force-dynamic";

const IMPORTS = [
  {
    step: "1",
    href: "/bulk-import/vendors",
    title: "Vendors",
    description: "The vendor list. Do this first so items can be assigned a default vendor.",
    template: "/vendors-import-template.csv",
  },
  {
    step: "2",
    href: "/bulk-import/items",
    title: "Items",
    description:
      "The item catalog — names, categories, units, sizes and default vendors. Defines items only; no stock.",
    template: "/items-import-template.csv",
  },
  {
    step: "3",
    href: "/bulk-import/inventory",
    title: "Starting balances",
    description:
      "On-hand quantities per site, one row per cost lot, with unit cost, vendor and received date.",
    template: "/import-template.csv",
  },
];

export default function BulkImportPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Bulk import</h1>
      <p className="mt-1 text-sm text-gray-500">
        Load data from CSV files. Each upload has a &quot;check only&quot; option
        that validates the file and reports problems without saving anything — use
        it first. The order below avoids most errors.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {IMPORTS.map((i) => (
          <div key={i.href} className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Step {i.step}</p>
            <h2 className="mt-1 text-base font-semibold text-gray-900">{i.title}</h2>
            <p className="mt-1 flex-1 text-sm text-gray-500">{i.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <Link
                href={i.href}
                className="whitespace-nowrap rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black"
              >
                Upload
              </Link>
              <a href={i.template} download className="text-sm text-[#134229] hover:underline">
                Template
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
