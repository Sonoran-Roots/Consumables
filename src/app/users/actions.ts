"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleAtLeast, type StaffRole } from "@/lib/access";
import { revalidatePath } from "next/cache";

export type UpdateUserAccessResult = { ok: true } | { ok: false; error: string };

// Re-checked here even though src/proxy.ts already keeps non-admins off
// this whole page — same defense-in-depth reasoning as confirmKioskPin
// re-verifying server-side at final submit rather than trusting an earlier
// client-side gate.
export async function updateUserAccess(
  userId: string,
  role: StaffRole,
  isPurchasingTeam: boolean
): Promise<UpdateUserAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !roleAtLeast(session.user.role as string | undefined, "ADMIN")) {
    return { ok: false, error: "Only an admin can change access." };
  }

  await db.user.update({
    where: { id: userId },
    data: { role, isPurchasingTeam },
  });

  revalidatePath("/users");
  return { ok: true };
}
