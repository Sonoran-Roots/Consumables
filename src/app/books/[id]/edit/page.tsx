import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import BookEditForm from "./book-edit-form";

export const dynamic = "force-dynamic";

export default async function EditBookPage({
  params,
}: PageProps<"/books/[id]/edit">) {
  const { id } = await params;

  const book = await db.book.findUnique({ where: { id } });
  if (!book) notFound();

  return (
    <div className="max-w-md">
      <BackLink href="/sites" label="Back to books & sites" />
      <h1 className="text-xl font-semibold text-gray-900">Edit book</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <BookEditForm book={book} />
      </div>
    </div>
  );
}
