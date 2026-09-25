"use client";

import { useRouter } from "next/navigation";
import type { Site, Book } from "@prisma/client";

type SiteWithBook = Site & { book: Book };

export default function SiteFilter({
  sites,
  selectedSiteId,
}: {
  sites: SiteWithBook[];
  selectedSiteId?: string;
}) {
  const router = useRouter();

  const byBook = new Map<string, { book: Book; sites: SiteWithBook[] }>();
  for (const site of sites) {
    const entry = byBook.get(site.book.id) ?? { book: site.book, sites: [] };
    entry.sites.push(site);
    byBook.set(site.book.id, entry);
  }

  return (
    <div className="max-w-xs">
      <label htmlFor="site-filter" className="block text-sm font-medium text-gray-700">
        Site
      </label>
      <select
        id="site-filter"
        value={selectedSiteId ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          router.push(value ? `/inventory?siteId=${value}` : "/inventory");
        }}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">All sites</option>
        {[...byBook.values()]
          .sort((a, b) => a.book.name.localeCompare(b.book.name))
          .map(({ book, sites: bookSites }) => (
            <optgroup key={book.id} label={book.name}>
              {bookSites
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
            </optgroup>
          ))}
      </select>
    </div>
  );
}
