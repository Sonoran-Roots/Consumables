import { db } from "@/lib/db";
import type { AuditRole } from "@/lib/access";
import { checkTransition, targetStatus, type FindingAction } from "./workflow";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Applies one workflow step to a finding and records it in the history.
// The update is conditional on the status the caller saw, so two people acting
// on the same finding at once can't both win.
export async function transitionFinding(
  findingId: string,
  action: FindingAction,
  actor: { userId: string; role: AuditRole },
  note: string
): Promise<ActionResult> {
  const finding = await db.iaFinding.findUnique({ where: { id: findingId }, select: { status: true } });
  if (!finding) return { ok: false, error: "That finding no longer exists." };

  const problem = checkTransition(finding.status, action, actor.role, note);
  if (problem) return { ok: false, error: problem };

  const to = targetStatus(action);
  const now = new Date();
  const cleanNote = note.trim() || null;
  const data =
    action === "NOTIFY"
      ? { notifiedAt: now }
      : action === "RESOLVE"
        ? { resolvedAt: now, resolvedById: actor.userId, resolutionNotes: cleanNote }
        : action === "VERIFY"
          ? { verifiedAt: now, verifiedById: actor.userId }
          : { notifiedAt: null, resolvedAt: null, resolvedById: null, verifiedAt: null, verifiedById: null }; // REOPEN

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.iaFinding.updateMany({
        where: { id: findingId, status: finding.status },
        data: { status: to, ...data },
      });
      if (updated.count === 0) throw new StatusChangedError();
      await tx.iaFindingEvent.create({
        data: { findingId, actorId: actor.userId, kind: "STATUS", fromStatus: finding.status, toStatus: to, note: cleanNote },
      });
    });
  } catch (e) {
    if (e instanceof StatusChangedError) {
      return { ok: false, error: "Someone else just changed this finding — refresh and try again." };
    }
    throw e;
  }
  return { ok: true };
}

class StatusChangedError extends Error {}
