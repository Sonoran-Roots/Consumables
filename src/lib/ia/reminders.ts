// Reminders: nudging managers about overdue findings without nagging them.
// After a reminder goes out it's recorded on each finding; the next draft
// leaves out anything reminded within the "gap" so the same people aren't
// emailed about the same items every day.

export const REMINDER_GAP_CHOICES = [0, 3, 7] as const; // days; 0 = remind about everything overdue
export const DEFAULT_REMINDER_GAP = 3;

const DAY_MS = 86_400_000;

export function readGap(raw: string): number {
  const n = Number(raw);
  return (REMINDER_GAP_CHOICES as readonly number[]).includes(n) && raw !== "" ? n : DEFAULT_REMINDER_GAP;
}

export function splitRecentlyReminded<T extends { id: string }>(
  findings: T[],
  lastReminded: Map<string, Date>,
  gapDays: number,
  now = new Date()
): { send: T[]; recent: T[] } {
  const send: T[] = [];
  const recent: T[] = [];
  for (const f of findings) {
    const last = lastReminded.get(f.id);
    if (gapDays > 0 && last && now.getTime() - last.getTime() < gapDays * DAY_MS) recent.push(f);
    else send.push(f);
  }
  return { send, recent };
}
