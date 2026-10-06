import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { MODULE_HOME, modulesFor } from "@/lib/access";
import KioskCheckout from "./kiosk-checkout";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const [sites, employees, items] = await Promise.all([
    db.site.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Names only feed "Forgot your PIN?" — the checkout itself identifies
    // people by PIN, not from a list.
    db.employee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, pinDigest: true },
    }),
    db.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  // Never send the digest itself to the client — just whether one exists.
  const people = employees.map(({ id, name, pinDigest }) => ({
    id,
    name,
    hasPin: pinDigest != null,
  }));

  // The button back to the admin console only appears for a login that can open a
  // module; the shared tablet accounts can't, so they never see it. (The proxy
  // enforces the same rule on the pages themselves.)
  const session = await auth.api.getSession({ headers: await headers() });
  const modules = session ? modulesFor(session.user as { isPurchasingTeam?: boolean; auditRole?: string | null }) : [];
  const adminHref = modules.length === 0 ? null : modules.length === 1 ? MODULE_HOME[modules[0]] : "/modules";

  return <KioskCheckout sites={sites} people={people} items={items} adminHref={adminHref} />;
}
