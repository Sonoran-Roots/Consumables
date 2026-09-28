import BackLink from "@/components/back-link";
import { db } from "@/lib/db";
import UsersTable from "./users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, isPurchasingTeam: true },
  });

  return (
    <div>
      <BackLink href="/" label="Back to dashboard" />
      <h1 className="text-xl font-semibold text-gray-900">App users</h1>
      <p className="mt-1 text-sm text-gray-500">
        Only checked accounts can reach the desktop app at all — everyone else is sent straight to
        the kiosk. Role only matters for accounts that are checked.
      </p>

      <div className="mt-6">
        <UsersTable users={users} />
      </div>
    </div>
  );
}
