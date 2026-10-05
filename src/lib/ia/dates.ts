// Dates in the old trackers come in several spellings (2026-01-13, 1/13/2026,
// 5.14.26 ...). Everything is stored at noon UTC so a date never shifts a day
// with the viewer's timezone.

const at = (y: number, m: number, d: number): Date | null => {
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
};

export function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return at(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s); // M/D/YY, M.D.YYYY, ...
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return at(year, +m[1], +m[2]);
  }
  return null;
}

export const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);

export const toDateInput = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : "");

export const formatDate = (d: Date | null | undefined): string =>
  d
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    : "—";
