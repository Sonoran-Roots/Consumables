import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { roleAtLeast } from "@/lib/access";

// Server Actions are reachable by direct POST, so each one re-checks the role
// itself rather than trusting that the page (or the proxy) already did.
export async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !roleAtLeast(session.user.role as string | undefined, "ADMIN")) return null;
  return session;
}
