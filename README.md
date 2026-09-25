# Sonoranroots Inventory

A web app replacing the spreadsheet-based consumable inventory system across
Sonoranroots' four accounting books (Retail, Cultivation, Manufacturing,
Joint Venture/Admin). See `ANALYSIS.md` (in the `consumables` folder this
project was built from) for the full analysis of the legacy system and the
rationale behind this data model.

**v1 scope:** core inventory tracking, inter-site transfers with a real
status workflow, and employee-accountable checkouts. Forecasting, alerts,
and full purchasing/vendor-credit workflows are deferred to later phases
(the schema already has minimal support for purchasing — see
`prisma/schema.prisma`).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **PostgreSQL** via **Prisma ORM 7** (stable — intentionally not the
  Prisma 8 release candidate, which is a still-shifting pre-release with a
  different architecture)
- Auth: not yet wired up. Planned: Microsoft Entra ID SSO via Auth.js, to
  be added once the company's employees are ready to be onboarded.
- Analytics: planned nightly/batch sync from Postgres into Snowflake for
  reporting in Omni (not yet implemented — the operational database stays
  Postgres; Snowflake is fed from it, not written to directly).

## Local development

Requires Node.js 20+.

```bash
npm install
```

You need a Postgres connection string in `.env` as `DATABASE_URL`. Local dev
uses a free **Neon** Postgres project (`sonoranroots-inventory`, database
`inventory_dev`, under the Sonoran Roots Neon org) rather than a local
Postgres install or Prisma's own bundled dev server — the latter
(`npx prisma dev`) repeatedly died mid-session during development (stuck
lock files, dead connections that even survived a restart) and cost real
time to recover from. Neon's free tier has been solid in comparison and
needs no local install.

Get the connection string from the Neon console (or `npx neonctl connection-string --profile <your-profile>`)
and put it in `.env` as `DATABASE_URL`. For staging/production, point
`DATABASE_URL` at a real persistent instance instead (e.g. Azure Database
for PostgreSQL, or a separate Neon project/branch).

Then set up the schema and seed reference data (books, sites, categories,
units of measure — no items or transactions, since we're starting fresh
rather than importing history):

```bash
npm run db:migrate   # applies prisma/migrations, generates the client
npm run db:seed      # seeds books/sites/categories/UOMs
npm run dev          # http://localhost:3000
```

Other useful commands:

```bash
npm run db:studio    # visual data browser
npm run db:generate  # regenerate the Prisma client after schema changes
```

## Project structure

- `prisma/schema.prisma` — the full v1 data model
- `prisma/seed.ts` — reference/master data seed (books, sites, categories, UOMs)
- `src/lib/db.ts` — Prisma client singleton (uses the `pg` driver adapter,
  which Prisma 7 requires instead of a schema-level `url`)
- `src/app/*` — one folder per feature (items, sites, inventory, transfers,
  checkouts, employees), each with a `page.tsx`, and `actions.ts` for
  Server Actions where the feature has mutations

Every list/detail page that reads live database state is marked
`export const dynamic = "force-dynamic"`. Without it, Next.js's default
caching model would prerender the page once at build time and serve stale
data — a correctness bug for an app whose whole point is showing current
inventory.

Note: the legacy spreadsheets had a "The Highway" pseudo-site in every book —
not a real location, just a Google Sheets tab that recorded transactions for
other site sheets to read and auto-update from (see `ANALYSIS.md` §2.7).
The `inventory_transactions` ledger table (and every site's live `groupBy`
computed on-hand) *is* that mechanism now, so there's no need for a
"Highway" site at all — it was seeded once during initial development and
has since been removed. `Site.isStaging`/`SiteType.STAGING` still exist in
the schema for a genuine physical staging/receiving location, if one is
ever needed — just don't reintroduce a "Highway"-style virtual ledger site.

## CSV import

`/import` bulk-loads a starting item list and current on-hand quantities
(one `OPENING_BALANCE` ledger entry per row — see `TransactionType` in the
schema). Download the template from that page for the exact column format.
If an item name doesn't already exist, `category` and `uom` are required so
it can be created on the fly; category values also match against the
legacy category names from the old spreadsheets (`LegacyCategoryAlias`).
Site names that exist in more than one book need the site code instead —
the error message tells you which code to use.

The import logic lives in `src/app/import/import-logic.ts`, separate from
the `"use server"` action wrapper in `actions.ts`, specifically so it can be
exercised directly with `tsx` without needing a real Next.js request
context (`revalidatePath` throws outside one).

## Audits

`/audits/new` starts an audit for a site: it snapshots the current computed
on-hand quantity for every item at that site into `AuditLine.systemQtyAtAudit`.
The audit detail page has a "+ Add item" control to bring in any item not
already on the audit — e.g. one the system currently shows at zero but is
physically on the shelf — so a monthly "count everything" audit isn't
limited to items that already had a nonzero balance. Enter the physical
count into "Ending quantity" (the field is internally still `countedQty` —
that name is accurate to what's stored, "Ending quantity" is just the
user-facing label matching the team's existing vocabulary) and either "Save
counts" (keeps it `IN_PROGRESS`, counts editable) or "Finalize audit" —
finalizing posts a `DISCREPANCY` ledger transaction for every line whose
ending quantity differs from the system quantity, then locks the audit.
Note: dates on `Audit.auditDate` are stored/compared as UTC calendar dates
(no time-of-day) — always render them with `{ timeZone: "UTC" }` or they'll
appear off by one day depending on the server's local timezone.

## Books & Sites

`/sites` lists every book with its assigned sites, and lets you activate or
deactivate a site in place (replaces hiding retired-site tabs). `/books/new`
creates a new accounting book (name + short code); `/sites/new` creates a
site and assigns it to a book, with the site code auto-suggested from the
book code + site name (editable, and still enforced unique by the database
either way). `/sites/[id]/edit` edits an existing site's name, code,
address, type, active flag, and — the main reason it exists — its book
assignment: reassigning just updates `Site.bookId`, nothing else about the
site's transaction history moves.

## Purchasing

`/purchasing` (POs) and `/vendors` replace the separate Purchasing/EOM
Prepaid Inventory Report & Credit Tracking workbook. A PO is invoice-shaped:
a header (site, vendor, PO#, order date) plus real `PurchaseOrderLine` rows
— item, quantity ordered, unit cost — built with the same add-line UI as
Transfers/Checkouts. A PO is always received at the one site named on its
header, even when the goods arrive in several partial deliveries.

The PO detail page has:

- **Line items** — the invoice body: ordered qty, unit cost, line total,
  and (computed live) quantity received and remaining per line.
- **Record a delivery** — the only action that moves inventory, and the
  core of the "auto-update on receiving" behavior: pick a date, enter how
  much of each remaining line arrived, submit. Each non-zero quantity posts
  a real `PURCHASE` ledger transaction at the PO's site immediately,
  tagged with `purchaseOrderLineId` — so "how much of item X has arrived,
  and on what days" is always a live query against the ledger, not a
  separate hand-maintained log. Lines that are already fully received drop
  out of the form. The PO's status (`OPEN` → `PARTIALLY_RECEIVED` →
  `FULLY_RECEIVED`) recomputes automatically after every delivery by
  comparing received-to-date against `quantityOrdered` on every line.
- **Delivery history** — every delivery ever recorded against this PO
  (date, item, quantity), newest first — pulled directly from the
  `InventoryTransaction` rows the deliveries created, so there's no
  separate table to keep in sync.
- **Payments** (`PurchaseOrderPayment`) plus a one-click "mark paid in full".
- **Vendor credits** (`VendorCredit`), optionally linked to the PO, with an
  "accounting notified" flag — stays open even after the PO is closed.

"Close PO" locks receiving/payment logging but leaves vendor credits open,
since a credit can still come in after a PO is otherwise done.

## Current-state inventory data

The app was seeded with real current-inventory balances extracted from the
legacy spreadsheets on 2026-09-24 — 833 `OPENING_BALANCE` rows across 452
items and 17 of the 19 active sites. See `INVENTORY_IMPORT_2026-09-24.md`
for the full methodology, judgment calls, and known data-quality flags
(e.g. two sites with no resolvable source data, a couple of items with
inferred rather than confirmed metadata, and small negative quantities kept
as-is pending a physical audit).

## Not yet built

- Microsoft Entra ID authentication
- Snowflake sync job for Omni reporting
- Forecasting and low-stock alerts (explicitly deferred to a later phase)
