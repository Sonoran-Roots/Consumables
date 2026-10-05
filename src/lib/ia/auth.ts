import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAuditRole, type AuditRole } from "@/lib/access";

// Server Actions are reachable by direct POST, so each one re-checks the
// caller's Inventory Audit role itself instead of trusting the page or proxy.
export async function getAuditSession(allowed?: AuditRole[]) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { auditRole?: string | null }).auditRole;
  if (!isAuditRole(role)) return null;
  if (allowed && !allowed.includes(role)) return null;
  return { userId: session.user.id, name: session.user.name || session.user.email, role };
}
