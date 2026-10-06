import { csvCell as cell } from "./csv";
import { formatDutchieDateTime } from "./dates";

export type DutchieExportLine = {
  dutchieId: string | null;
  pid: string | null;
  brand: string | null;
  product: string | null;
  systemQty: number | null;
  actualQty: number | null;
  note: string | null;
  countedAt: Date | null;
  // The line's quantity finding, if the count changed.
  countFinding: { foundAt: Date; reasonName: string | null } | null;
};

export const DUTCHIE_HEADERS = ["Id", "Package ID", "External Package ID", "Label Source", "Brand", "Product Name", "Counted On", "Note", "Expected Qty", "Counted Qty", "Adjustment Reason"];

// Dutchie's own audit table, filled from this audit: unchanged packages show
// their expected quantity as counted (as Dutchie does), and only packages whose
// count changed carry a time, note and reason.
export function buildDutchieTable(lines: DutchieExportLine[]): string {
  const rows = lines.map((l) => {
    const changed = l.countFinding;
    return [
      l.dutchieId, l.pid, l.pid, "", l.brand, l.product,
      changed ? formatDutchieDateTime(l.countedAt ?? changed.foundAt) : "",
      changed ? l.note : "",
      l.systemQty, l.actualQty ?? l.systemQty, changed?.reasonName ?? "",
    ].map(cell).join(",");
  });
  return [DUTCHIE_HEADERS.map(cell).join(","), ...rows].join("\r\n");
}
