import "dotenv/config";
import { db } from "../src/lib/db";

// Reference/master data only — books, sites, categories, units of measure.
// Per the 2026-09-23 decision, we start fresh with current balances rather
// than importing historical transactions, so no items or transactions are
// seeded here. See ANALYSIS.md (Downloads/consumables) for the source data.

const BOOKS: Record<string, { code: string; sites: string[] }> = {
  Retail: {
    code: "RTL",
    sites: [
      "Ponderosa Tucson",
      "Ponderosa Queen Creek",
      "Ponderosa Glendale",
      "Ponderosa Tempe-Mesa",
      "Ponderosa Flagstaff",
      "Ponderosa Phoenix",
      "Ponderosa Chandler",
      "Ponderosa Mesa",
    ],
  },
  Cultivation: {
    code: "CUL",
    sites: ["5th St", "Roosevelt", "SR Warehouse", "McKellips", "Marketing"],
  },
  Manufacturing: {
    code: "MFG",
    sites: [
      "Canamo (PBC)",
      "SR - Flower Packaging",
      "5th St 3rd Party Toll Processing",
      "McDowell 3rd Party Toll Processing",
    ],
  },
  "Joint Venture/Admin": {
    code: "JVA",
    sites: ["McDowell HQ", "Charlies"],
  },
};

// Consolidated category taxonomy from the company's own "Category key" tab,
// with legacy raw category names mapped as aliases.
const CATEGORIES: Record<string, string[]> = {
  Merch: [
    "Concepts Merch",
    "Ponderosa Merch",
    "Sonoran Roots Merch",
    "Concentrates Merch",
    "Charlies Merch",
  ],
  "Production Supplies": ["Production Supplies", "Production"],
  "Grow Supplies": [
    "Grow Supplies",
    "Grow Supplies (East Wing)",
    "Grow Supplies (West Wing)",
  ],
  "Extraction Supplies": ["Extraction Supplies"],
  Solvents: ["Solvents"],
  PPE: ["PPE"],
  "Sales Supplies": ["Sales Supplies"],
  "Office Supplies": ["Office Supplies"],
  Janitorial: ["Janitorial"],
  "Research & Development": ["Research & Development", "Reserach & Development"],
  Miscellaneous: ["Miscellaneous", "AC Filters"],
  "Packaging Supplies": [
    "Concentrate Packaging",
    "Concepts Packaging",
    "E-Commerce Packaging",
  ],
  "Finished Goods": ["Concepts Finished Product"],
  Equipment: ["Equipment Supplies"],
};

const UNITS_OF_MEASURE = [
  "Unit",
  "Bundle",
  "Filter",
  "Bag",
  "Tank",
  "Roll",
  "Gallon",
  "Case",
  "Box",
];

async function main() {
  for (const [bookName, { code, sites }] of Object.entries(BOOKS)) {
    const book = await db.book.upsert({
      where: { name: bookName },
      update: {},
      create: { name: bookName, code },
    });

    for (const siteName of sites) {
      const siteCode = `${code}-${siteName.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase()}`;
      await db.site.upsert({
        where: { code: siteCode },
        update: {},
        create: { name: siteName, code: siteCode, bookId: book.id },
      });
    }
  }
  console.log(`Seeded ${Object.keys(BOOKS).length} books and their sites.`);

  for (const [categoryName, legacyNames] of Object.entries(CATEGORIES)) {
    const category = await db.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    for (const rawName of legacyNames) {
      await db.legacyCategoryAlias.upsert({
        where: { rawCategoryName: rawName },
        update: { categoryId: category.id },
        create: { rawCategoryName: rawName, categoryId: category.id },
      });
    }
  }
  console.log(`Seeded ${Object.keys(CATEGORIES).length} categories with legacy aliases.`);

  for (const code of UNITS_OF_MEASURE) {
    await db.unitOfMeasure.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
  console.log(`Seeded ${UNITS_OF_MEASURE.length} units of measure.`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
