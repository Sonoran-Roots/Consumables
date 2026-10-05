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

// The inventory team copied a drafted email to `recipient` and sent it. Every
// listed finding gets a note saying so; those still Open move to Notified (the
// department has now been told), and the rest are left as they are.
export async function markEmailed(
  findingIds: string[],
  recipient: string,
  actor: { userId: string }
): Promise<{ notified: number; noted: number }> {
  if (findingIds.length === 0) return { notified: 0, noted: 0 };
  const open = await db.iaFinding.findMany({ where: { id: { in: findingIds }, status: "OPEN" }, select: { id: true } });
  const openIds = open.map((f) => f.id);
  const note = `Emailed to ${recipient}`;

  await db.$transaction(async (tx) => {
    const moved = await tx.iaFinding.updateMany({
      where: { id: { in: openIds }, status: "OPEN" },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });
    if (moved.count > 0) {
      await tx.iaFindingEvent.createMany({
        data: openIds.map((id) => ({ findingId: id, actorId: actor.userId, kind: "STATUS", fromStatus: "OPEN" as const, toStatus: "NOTIFIED" as const, note })),
      });
    }
    const rest = findingIds.filter((id) => !openIds.includes(id));
    if (rest.length > 0) {
      await tx.iaFindingEvent.createMany({ data: rest.map((id) => ({ findingId: id, actorId: actor.userId, kind: "NOTE", note })) });
    }
  });
  return { notified: openIds.length, noted: findingIds.length - openIds.length };
}
