import Link from "next/link";
import { db } from "@/lib/db";

// Reads live counts and recent activity — must render per request, not once at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [itemCount, siteCount, bookCount, openTransfers, recentTransfers] =
    await Promise.all([
      db.item.count(),
      db.site.count({ where: { isActive: true } }),
      db.book.count(),
      db.transfer.count({ where: { status: { in: ["REQUESTED", "IN_TRANSIT"] } } }),
      db.transfer.findMany({
        orderBy: { requestedAt: "desc" },
        take: 5,
        include: { fromSite: true, toSite: true },
      }),
    ]);

  const stats = [
    { label: "Books", value: bookCount, href: "/sites" },
    { label: "Active sites", value: siteCount, href: "/sites" },
    { label: "Items tracked", value: itemCount, href: "/items" },
    { label: "Open transfers", value: openTransfers, href: "/transfers" },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Replacing the spreadsheet system, one book at a time.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-gray-200 bg-white p-4 hover:border-emerald-300"
          >
            <div className="text-2xl font-semibold text-gray-900">{s.value}</div>
            <div className="mt-1 text-sm text-gray-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-700">Recent transfers</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {recentTransfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/transfers/${t.id}`} className="hover:underline">
                  {t.fromSite.name} &rarr; {t.toSite.name}
                </Link>
                <span className="text-gray-400">{t.status.replace("_", " ")}</span>
              </li>
            ))}
            {recentTransfers.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">
                No transfers yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
