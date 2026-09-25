import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import SiteEditForm from "./site-edit-form";

export const dynamic = "force-dynamic";

export default async function EditSitePage({
  params,
}: PageProps<"/sites/[id]/edit">) {
  const { id } = await params;

  const [site, books] = await Promise.all([
    db.site.findUnique({ where: { id } }),
    db.book.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!site) notFound();

  return (
    <div className="max-w-md">
      <BackLink href="/sites" label="Back to books & sites" />
      <h1 className="text-xl font-semibold text-gray-900">Edit site</h1>
      <p className="mt-1 text-sm text-gray-500">
        Reassigning the book just changes grouping — nothing else about the
        site&apos;s history moves.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <SiteEditForm site={site} books={books} />
      </div>
    </div>
  );
}
