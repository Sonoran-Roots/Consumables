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
    db.employee.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, pinHash: true },
    }),
    db.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  // Never send the hash itself to the client — just whether one exists.
  const employeesWithPinFlag = employees.map(({ id, name, pinHash }) => ({
    id,
    name,
    hasPin: pinHash != null,
  }));

  return <KioskCheckout sites={sites} employees={employeesWithPinFlag} items={items} />;
}
