import { STATUS_LABEL, type FindingStatus } from "@/lib/ia/workflow";

const STYLE: Record<FindingStatus, string> = {
  OPEN: "bg-red-50 text-red-700 ring-red-200",
  NOTIFIED: "bg-amber-50 text-amber-800 ring-amber-200",
  RESOLVED: "bg-blue-50 text-blue-700 ring-blue-200",
  VERIFIED: "bg-[#e5f3e5] text-[#0e3020] ring-green-200",
};

export default function StatusBadge({ status, overdue }: { status: FindingStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLE[status]}`}>
        {STATUS_LABEL[status]}
      </span>
      {overdue && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Overdue</span>}
    </span>
  );
}
