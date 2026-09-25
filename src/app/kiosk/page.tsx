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
      select: { id: true, name: true },
    }),
    db.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  return <KioskCheckout sites={sites} employees={employees} items={items} />;
}
