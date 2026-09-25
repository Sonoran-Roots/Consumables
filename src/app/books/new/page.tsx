import BackLink from "@/components/back-link";
import BookForm from "./book-form";

export const dynamic = "force-dynamic";

export default function NewBookPage() {
  return (
    <div className="max-w-md">
      <BackLink href="/sites" label="Back to books & sites" />
      <h1 className="text-xl font-semibold text-gray-900">New book</h1>
      <p className="mt-1 text-sm text-gray-500">
        An accounting book — e.g. Retail, Cultivation, Manufacturing, Joint
        Venture/Admin. Add sites to it afterward.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <BookForm />
      </div>
    </div>
  );
}
