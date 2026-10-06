// Cultivation audits count plants, not packages. Dutchie's plant Inventory
// export has one row per plant (or one per seed lot); the audit works on the
// batch in a room: "5th - Flower 104, batch 20260914-0907, Guava Bomba: 144
// plants". Pure (no database) so it can be tested on its own.
import { pick } from "./csv";
import { readQuantity, readTable, type ParsedLine } from "./audit-import";
import { squash } from "./lookup";

export type CultivationStage = "ALL" | "CLONE" | "VEG" | "FLOWER";

export const CULTIVATION_PREFIX = "CULTIVATION";
export const STAGE_LABEL: Record<CultivationStage, string> = { ALL: "All stages", CLONE: "Clone", VEG: "Veg", FLOWER: "Flower" };

// The audit's dutchieType: "CULTIVATION" for every stage, or "CULTIVATION_CLONE" etc.
export const cultivationType = (stage: CultivationStage) => (stage === "ALL" ? CULTIVATION_PREFIX : `${CULTIVATION_PREFIX}_${stage}`);
export const isCultivationType = (t: string | null | undefined): boolean => !!t && t.startsWith(CULTIVATION_PREFIX);
export function cultivationLabel(t: string | null | undefined): string {
  const stage = (t ?? "").split("_")[1] as CultivationStage | undefined;
  return stage && STAGE_LABEL[stage] ? `${STAGE_LABEL[stage]} cultivation audit` : "Cultivation audit";
}
export const parseStage = (v: string): CultivationStage => (["CLONE", "VEG", "FLOWER"].includes(v) ? (v as CultivationStage) : "ALL");

// Dutchie's Stage column -> the stage an audit is run for.
const STAGE_OF = (stage: string): CultivationStage | null => {
  const s = squash(stage);
  if (s.startsWith("clone")) return "CLONE";
  if (s.startsWith("veg")) return "VEG";
  if (s.startsWith("flower")) return "FLOWER";
  return null;
};

export type CultivationParse = { lines: ParsedLine[]; plants: number; skippedDestroyed: number; skippedOtherStages: number; error?: string };

export function parseCultivationLines(text: string, stage: CultivationStage): CultivationParse {
  const empty = (error: string): CultivationParse => ({ lines: [], plants: 0, skippedDestroyed: 0, skippedOtherStages: 0, error });
  const { rows, error } = readTable(text);
  if (error) return empty(error);
  if (rows.length > 0 && !("stage" in rows[0]) && !rows.some((r) => r.stage) && !rows.some((r) => r.serialno)) {
    return empty("This doesn't look like Dutchie's plant inventory export — it needs Serial no., Harvest batch, Strain, Room, Stage and Count columns.");
  }

  type Group = { room: string | null; batchId: string | null; strain: string | null; category: string; count: number; first: string | null; last: string | null };
  const groups = new Map<string, Group>();
  let skippedDestroyed = 0, skippedOtherStages = 0, plants = 0;

  for (const row of rows) {
    if (pick(row, ["destroyed"])) { skippedDestroyed++; continue; }
    const rowStage = pick(row, ["stage"]);
    const kind = pick(row, ["type"]).toLowerCase();
    const isSeed = kind === "seed";
    const rowStageKey = STAGE_OF(rowStage);
    // Seeds have no stage; they belong to "all stages" audits only.
    if (stage !== "ALL" && rowStageKey !== stage) { skippedOtherStages++; continue; }

    const count = readQuantity(pick(row, ["count"])).value ?? 1;
    const category = isSeed ? "Seeds" : rowStage || "Plants";
    const room = pick(row, ["room"]) || null;
    const batchId = pick(row, ["harvestbatch", "batch", "batchid"]) || null;
    const strain = pick(row, ["strain"]) || null;
    const serial = pick(row, ["serialno", "serial"]) || null;
    const key = [room, category, batchId, strain].join("\u0000");

    let g = groups.get(key);
    if (!g) groups.set(key, (g = { room, batchId, strain, category, count: 0, first: serial, last: serial }));
    g.count += count;
    plants += count;
    if (serial) {
      if (!g.first || serial < g.first) g.first = serial;
      if (!g.last || serial > g.last) g.last = serial;
    }
  }

  if (groups.size === 0) {
    return empty(stage === "ALL" ? "No plants found in the file." : `No ${STAGE_LABEL[stage].toLowerCase()} plants found in the file — check the stage you chose.`);
  }

  // Room by room, then batch, so the auditors work through one room at a time.
  const sorted = [...groups.values()].sort((a, b) =>
    (a.room ?? "").localeCompare(b.room ?? "", "en", { numeric: true }) ||
    a.category.localeCompare(b.category) || (a.batchId ?? "").localeCompare(b.batchId ?? "", "en", { numeric: true }) || (a.strain ?? "").localeCompare(b.strain ?? ""));

  const lines: ParsedLine[] = sorted.map((g, i) => ({
    position: i + 1,
    product: g.strain,
    strain: g.strain,
    batchId: g.batchId,
    pid: null,
    room: g.room,
    // The plant tags in this group, first to last, for the auditors to look up.
    serialNo: g.first && g.last ? (g.first === g.last ? g.first : `${g.first} – ${g.last}`) : null,
    unit: g.category === "Seeds" ? "seeds" : "plants",
    category: g.category,
    itemStatus: null, harvestDate: null, expirationDate: null, manufactureDate: null, allocatedQty: null,
    systemQty: g.count,
    dutchieId: null,
    brand: null,
  }));
  return { lines, plants, skippedDestroyed, skippedOtherStages };
}
