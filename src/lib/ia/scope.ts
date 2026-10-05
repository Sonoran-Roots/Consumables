import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AuditRole } from "@/lib/access";
import { visibleWhere } from "./routing";

// What this person may see. Auditors (the inventory team) and admins see every
// finding; a manager sees only the ones routed to them.
export async function findingScope(me: { userId: string; role: AuditRole }): Promise<Prisma.IaFindingWhereInput> {
  if (me.role !== "MANAGER") return {};
  const rules = await db.iaCoverage.findMany({ where: { userId: me.userId } });
  return visibleWhere(me.userId, rules);
}

export async function canSeeFinding(me: { userId: string; role: AuditRole }, findingId: string): Promise<boolean> {
  const scope = await findingScope(me);
  return (await db.iaFinding.count({ where: { AND: [{ id: findingId }, scope] } })) > 0;
}
