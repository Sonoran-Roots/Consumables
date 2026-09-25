# Current-state inventory import — 2026-09-24

This documents how the app's starting inventory numbers were derived from the
legacy spreadsheets, for anyone auditing "where did this number come from."

## What was imported

833 (item, site) balances across 452 distinct items and 17 of the 19 active
sites, posted as `OPENING_BALANCE` ledger transactions (see `TransactionType`
in `prisma/schema.prisma`). No historical transaction history was imported —
per an earlier decision, the app starts fresh from a current-state snapshot
rather than carrying over the old system's transaction log. "The Highway"
tabs (a virtual staging ledger, never a real site) were excluded entirely.

## Source and per-item methodology

For each site, in that book's legacy workbook:

1. Looked at the `<Site> Active Inventory` tab's "Available Stock" column —
   the old system's own computed running total.
2. If a more recent `<Site> Audit - M.DD.YY` tab (or, for Retail, an inline
   "Mid Month Consumable Audit" column on the Active Inventory tab itself —
   Retail's workbook has no separate dated audit tabs) had a physical count
   for that item, that count was used instead — a physical count is more
   authoritative than a computed total.
3. Zero/blank-quantity items were skipped (no `OPENING_BALANCE` row).

Item master metadata (brand, generic name, variant, size, category, unit of
measure, material type, SKU) was cross-referenced from `Master Consumables
Tracker.xlsx`'s "Items List" tab, falling back to each book's own "Key" tab.

## Sites with no data

- **McDowell HQ** (Joint Venture/Admin) and **McDowell 3rd Party Toll
  Processing** (Manufacturing): neither has an Active Inventory tab in the
  source workbook, and their transaction-ledger tabs show no resolvable
  running balance for any item. No opening balances were imported for either
  — both start at zero in the new app until real counts are entered.
- **McKellips** (Cultivation): has an Active Inventory tab, but every row is
  zero, consistent with it being a retired/inactive site in the old system.

## Judgment calls worth knowing about

- **"Canamo Merch"** was not one of the company's existing consolidated
  categories or logged legacy aliases. Added it as a new alias to the
  existing **Merch** category (matching the same pattern as Concepts Merch,
  Ponderosa Merch, Sonoran Roots Merch, Concentrates Merch, Charlies Merch).
- Seven units of measure that didn't already exist were added: `LB`,
  `Pack/15`, `Pair`, `Bottle`, `Container`, `Kit`, `g`.
- **"Head and Beard Combo- blue - McDowell"** (SR Warehouse, qty 7) had no
  match in either item master list under that exact name. Classified as
  **PPE / Unit / IM** by inference from similar items (Hair Nets, Gloves) —
  worth double-checking against the physical item.
- **"Rooted - 510 Vape"** (5th St 3rd Party Toll Processing, qty 107) is
  missing the size suffix that the item master's "Rooted - 510 Vape - 1G"
  has; treated as a distinct item using that entry's category/UOM/material
  type (Packaging Supplies / Unit / PM) since it's genuinely a separate
  string in the source data — worth confirming whether it's the same
  physical item as "- 1G" and should be merged.
- **Negative quantities were kept as-is** where the source genuinely showed
  them (all at Charlies, which has no audit tab to correct against):
  "RAW - King Preroll Cones - 800 ct" (-15), "Trash Bags - 13 gallon" (-1),
  "Trash Bags - 55-60 gallon" (-1). These likely reflect a real timing/lag
  discrepancy in the old system and should be corrected via a physical count
  in the new app's Audits feature rather than assumed to be zero.
- One clearly erroneous outlier was caught and corrected during extraction:
  Ponderosa Phoenix's "Exit Bags - Skele" showed **Available Stock = -1194**
  (a checkout-log data-entry error in the old system), but its own inline
  audit count was 5 — the audit count was used, per the methodology above.

## A bug this import surfaced and fixed

The CSV importer (`src/app/import/import-logic.ts`) originally created every
new item inside a single Prisma interactive transaction alongside the ledger
insert. With ~450 new items to create, this reliably exceeded Prisma's
default 5-second transaction timeout and failed outright. Fixed by creating
items outside the transaction (harmless if interrupted — an item with no
ledger row yet is just at zero on-hand) and keeping only the final ledger
`createMany` batched. Anyone importing a large CSV through `/import` in the
future benefits from this fix automatically.
