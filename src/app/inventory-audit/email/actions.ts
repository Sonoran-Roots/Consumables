"use server";

import { revalidatePath } from "next/cache";
import { getAuditSession } from "@/lib/ia/auth";
import { markEmailed } from "@/lib/ia/findings";
import { CAN_ENTER_FINDINGS } from "@/lib/ia/workflow";

export async function markFindingsEmailed(
  findingIds: string[],
  recipient: string,
  mode: "notice" | "reminder" = "notice"
): Promise<{ ok: true; notified: number } | { ok: false; error: string }> {
  const me = await getAuditSession(CAN_ENTER_FINDINGS);
  if (!me) return { ok: false, error: "Only the inventory team can do that." };
  if (!Array.isArray(findingIds) || findingIds.length === 0 || findingIds.length > 3000) {
    return { ok: false, error: "Nothing to mark." };
  }
  const result = await markEmailed(findingIds.map(String), String(recipient).slice(0, 200), { userId: me.userId }, mode === "reminder" ? "reminder" : "notice");
  revalidatePath("/inventory-audit", "layout");
  return { ok: true, notified: result.notified };
}
