import Link from "next/link";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import SiteForm from "./site-form";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const books = await db.book.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-md">
      <BackLink href="/sites" label="Back to books & sites" />
      <h1 className="text-xl font-semibold text-gray-900">New site</h1>
      <p className="mt-1 text-sm text-gray-500">
        A physical site (or staging location) assigned to one book.
      </p>

      {books.length === 0 && (
        <p className="mt-2 text-sm text-amber-700">
          No books yet —{" "}
          <Link href="/books/new" className="underline">
            create one first
          </Link>
          .
        </p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <SiteForm books={books} />
      </div>
    </div>
  );
}
