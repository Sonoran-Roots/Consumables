// Inventory Audit finding workflow — pure rules, no database access, so they
// can be tested exhaustively and shared by the UI (which buttons to show) and
// the server actions (which re-check before changing anything).
//
//   OPEN -> NOTIFIED -> RESOLVED -> VERIFIED          (reopen: back to OPEN)
//
// Who does what mirrors the old tracker's columns: the inventory team
// (AUDITOR) tells the departments and verifies at the end; the department's
// manager (MANAGER) confirms the fix; ADMIN can do all of it.
import type { AuditRole } from "@/lib/access";

export type FindingStatus = "OPEN" | "NOTIFIED" | "RESOLVED" | "VERIFIED";
export type FindingAction = "NOTIFY" | "RESOLVE" | "VERIFY" | "REOPEN";

export const STATUS_LABEL: Record<FindingStatus, string> = {
  OPEN: "Open",
  NOTIFIED: "Notified",
  RESOLVED: "Resolved",
  VERIFIED: "Verified",
};

type Rule = { from: FindingStatus[]; to: FindingStatus; roles: AuditRole[]; label: string; noteRequired: boolean };

const RULES: Record<FindingAction, Rule> = {
  NOTIFY: { from: ["OPEN"], to: "NOTIFIED", roles: ["AUDITOR", "AUDIT_MANAGER", "ADMIN"], label: "Mark teams notified", noteRequired: false },
  RESOLVE: { from: ["OPEN", "NOTIFIED"], to: "RESOLVED", roles: ["MANAGER", "ADMIN"], label: "Mark resolved", noteRequired: true },
  VERIFY: { from: ["RESOLVED"], to: "VERIFIED", roles: ["AUDITOR", "AUDIT_MANAGER", "ADMIN"], label: "Verify resolution", noteRequired: false },
  REOPEN: { from: ["NOTIFIED", "RESOLVED", "VERIFIED"], to: "OPEN", roles: ["AUDITOR", "AUDIT_MANAGER", "ADMIN"], label: "Reopen", noteRequired: true },
};

export type AvailableAction = { action: FindingAction; label: string; to: FindingStatus; noteRequired: boolean };

export function availableActions(status: FindingStatus, role: AuditRole | null): AvailableAction[] {
  if (!role) return [];
  return (Object.keys(RULES) as FindingAction[])
    .filter((a) => RULES[a].from.includes(status) && RULES[a].roles.includes(role))
    .map((a) => ({ action: a, label: RULES[a].label, to: RULES[a].to, noteRequired: RULES[a].noteRequired }));
}

// null when the move is allowed; otherwise why not.
export function checkTransition(
  status: FindingStatus,
  action: FindingAction,
  role: AuditRole | null,
  note: string
): string | null {
  const rule = RULES[action];
  if (!rule) return "Unknown action.";
  if (!role || !rule.roles.includes(role)) return "Your access level can't do that.";
  if (!rule.from.includes(status)) return `That can't be done to a finding that is ${STATUS_LABEL[status].toLowerCase()}.`;
  if (rule.noteRequired && !note.trim()) return action === "RESOLVE" ? "Say what was done to fix it." : "Say why it's being reopened.";
  return null;
}

export const targetStatus = (action: FindingAction): FindingStatus => RULES[action].to;

// Who may log or edit findings, change their routing, and use the settings.
// Count audits, log and edit findings, send the manager emails.
export const CAN_ENTER_FINDINGS: AuditRole[] = ["AUDITOR", "AUDIT_MANAGER", "ADMIN"];
// Start audits, complete and reopen them, review (triage) their findings and run the adjustments report.
export const CAN_RUN_AUDITS: AuditRole[] = ["AUDIT_MANAGER", "ADMIN"];
export const CAN_CONFIGURE: AuditRole[] = ["ADMIN"];

const DAY_MS = 86_400_000;
export const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// A finding is overdue once its due DATE has passed — due today is still on
// time. Only work nobody has finished yet (Open / Notified) can be overdue;
// once the department says it's fixed, the ball is with the inventory team.
// Database filters use overdueCutoff() so lists and counts agree with this.
export const overdueCutoff = (now = new Date()) => startOfUtcDay(now);

export function isOverdue(f: { status: FindingStatus; dueDate: Date | null }, now = new Date()): boolean {
  return f.dueDate != null && (f.status === "OPEN" || f.status === "NOTIFIED") && f.dueDate.getTime() < overdueCutoff(now).getTime();
}

// Whole days past due (due yesterday = 1); 0 when not overdue.
export function daysOverdue(f: { status: FindingStatus; dueDate: Date | null }, now = new Date()): number {
  if (!isOverdue(f, now)) return 0;
  return Math.ceil((overdueCutoff(now).getTime() - f.dueDate!.getTime()) / DAY_MS);
}
