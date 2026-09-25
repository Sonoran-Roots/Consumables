import Link from "next/link";
import { db } from "@/lib/db";
import { setSiteActive, deleteBook } from "./actions";
import DeleteBookButton from "./delete-book-button";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const books = await db.book.findMany({
    orderBy: { name: "asc" },
    include: {
      sites: {
        orderBy: { name: "asc" },
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Books &amp; Sites</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your accounting books and the physical sites assigned to each.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/books/new"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            New book
          </Link>
          <Link
            href="/sites/new"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            New site
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {books.map((book) => (
          <div key={book.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-900">{book.name}</h2>
              <span className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
                  {book.code}
                </span>
                {book.sites.length === 0 ? (
                  <form action={deleteBook}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <DeleteBookButton bookName={book.name} />
                  </form>
                ) : (
                  <span
                    className="text-xs text-gray-300"
                    title="Remove all sites from this book before deleting it"
                  >
                    delete
                  </span>
                )}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-gray-100">
              {book.sites.map((site) => (
                <li
                  key={site.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className={site.isActive ? "text-gray-800" : "text-gray-400"}>
                    {site.name}
                    {site.isStaging && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        staging
                      </span>
                    )}
                    {!site.isActive && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        inactive
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">
                      {site.code}
                    </span>
                    <Link
                      href={`/sites/${site.id}/edit`}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      edit
                    </Link>
                    <form action={setSiteActive}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={site.isActive ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                      >
                        {site.isActive ? "deactivate" : "activate"}
                      </button>
                    </form>
                  </span>
                </li>
              ))}
              {book.sites.length === 0 && (
                <li className="py-2 text-sm text-gray-400">No sites yet.</li>
              )}
            </ul>
          </div>
        ))}
        {books.length === 0 && (
          <p className="text-sm text-gray-400">
            No books yet.{" "}
            <Link href="/books/new" className="text-emerald-700 underline">
              Create one
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
