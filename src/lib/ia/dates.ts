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

// Dutchie shows times like "9/30/2026, 10:50:55 PM" in Arizona local time
// (UTC-7 all year — Arizona doesn't observe daylight saving).
const ARIZONA_OFFSET_HOURS = 7;

export function parseDutchieDateTime(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(raw.trim());
  if (!m) return parseFlexibleDate(raw);
  let hour = Number(m[4]) % 12;
  if (m[7].toUpperCase() === "PM") hour += 12;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hour + ARIZONA_OFFSET_HOURS, Number(m[5]), Number(m[6] ?? 0)));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDutchieDateTime(d: Date): string {
  const az = new Date(d.getTime() - ARIZONA_OFFSET_HOURS * 3_600_000);
  const h24 = az.getUTCHours();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${az.getUTCMonth() + 1}/${az.getUTCDate()}/${az.getUTCFullYear()}, ${h24 % 12 || 12}:${pad(az.getUTCMinutes())}:${pad(az.getUTCSeconds())} ${h24 >= 12 ? "PM" : "AM"}`;
}

export const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);

export const toDateInput = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : "");

export const formatDate = (d: Date | null | undefined): string =>
  d
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    : "—";
