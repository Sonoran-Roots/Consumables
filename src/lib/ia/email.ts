// Drafts the findings email for one recipient. Nothing is sent by the app: the
// inventory team copies the text into their own mail client. The wording
// around the list comes from the editable template; the list itself is
// generated, so every finding carries what the manager needs to act on it.
import { formatDate } from "./dates";
import { daysOverdue, type FindingStatus } from "./workflow";

export type EmailTemplate = { subject: string; intro: string; footer: string };

export type EmailFinding = {
  id: string;
  description: string;
  findingTypeName: string;
  categoryName: string | null;
  facilityName: string;
  departmentName: string;
  secondDepartmentName: string | null;
  auditDate: Date;
  dueDate: Date | null;
  status: string;
  product: string | null;
  batchId: string | null;
  pid: string | null;
  strain: string | null;
  room: string | null;
  serialNo: string | null;
  quantity: number | null;
  unit: string | null;
  correction: string | null;
};

export const TEMPLATE_PLACEHOLDERS = ["{managerName}", "{count}", "{date}", "{senderName}", "{reportLink}"] as const;

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole));
}

const byUrgency = (a: EmailFinding, b: EmailFinding) => {
  const da = a.dueDate?.getTime() ?? Infinity;
  const db = b.dueDate?.getTime() ?? Infinity;
  return da - db || a.auditDate.getTime() - b.auditDate.getTime();
};

export function buildEmail(input: {
  template: EmailTemplate;
  recipientName: string;
  findings: EmailFinding[];
  baseUrl: string;
  senderName: string;
  now?: Date;
}): { subject: string; body: string } {
  const now = input.now ?? new Date();
  const base = input.baseUrl.replace(/\/+$/, "");
  const vars = {
    managerName: input.recipientName,
    count: String(input.findings.length),
    date: formatDate(now),
    senderName: input.senderName,
    reportLink: `${base}/inventory-audit/report`,
  };

  const blocks = [...input.findings].sort(byUrgency).map((f, i) => {
    const late = daysOverdue({ status: f.status as FindingStatus, dueDate: f.dueDate }, now);
    const heading = `${i + 1}. ${f.findingTypeName}${f.categoryName ? ` — ${f.categoryName}` : ""}${late > 0 ? `  [OVERDUE: ${late} day${late === 1 ? "" : "s"}]` : ""}`;
    const where = [
      `Facility: ${f.facilityName}`,
      `Department: ${f.departmentName}${f.secondDepartmentName ? ` / ${f.secondDepartmentName}` : ""}`,
      `Audited: ${formatDate(f.auditDate)}`,
      `Due: ${f.dueDate ? formatDate(f.dueDate) : "no due date"}`,
    ].join(" · ");
    const item = [
      f.product,
      f.strain && `Strain ${f.strain}`,
      f.batchId && `Batch ${f.batchId}`,
      f.pid && `PID ${f.pid}`,
      f.room && `Room ${f.room}`,
      f.serialNo && `Serial ${f.serialNo}`,
      f.quantity != null && `Qty ${f.quantity}${f.unit ? ` ${f.unit}` : ""}`,
    ].filter(Boolean).join(" · ");
    return [
      heading,
      `   ${where}`,
      `   Finding: ${f.description}`,
      item && `   Item: ${item}`,
      f.correction && `   Correction: ${f.correction}`,
      `   Link: ${base}/inventory-audit/findings/${f.id}`,
    ].filter(Boolean).join("\n");
  });

  const body = [fillTemplate(input.template.intro, vars).trimEnd(), "", blocks.join("\n\n"), "", fillTemplate(input.template.footer, vars).trimEnd()].join("\n");
  return { subject: fillTemplate(input.template.subject, vars), body };
}

