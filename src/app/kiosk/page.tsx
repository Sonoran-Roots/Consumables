import { db } from "@/lib/db";
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

  return <KioskCheckout sites={sites} people={people} items={items} />;
}
