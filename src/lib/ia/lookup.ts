// Matches the free-text names in uploaded trackers ("McDowell - Hub", "Sales")
// to the configured facilities / departments / finding types, ignoring case,
// spacing and punctuation, and honoring each record's aliases.

export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Named = { id: string; name: string; aliases?: string[] };

export function buildLookup<T extends Named>(rows: T[]) {
  const map = new Map<string, T>();
  const clash = new Set<string>();
  for (const r of rows) {
    for (const label of [r.name, ...(r.aliases ?? [])]) {
      const k = squash(label);
      if (!k) continue;
      const prior = map.get(k);
      if (prior && prior.id !== r.id) clash.add(k);
      else map.set(k, r);
    }
  }
  // A spelling claimed by two different records can't be trusted to mean either.
  for (const k of clash) map.delete(k);
  return (raw: string): T | undefined => map.get(squash(raw));
}
