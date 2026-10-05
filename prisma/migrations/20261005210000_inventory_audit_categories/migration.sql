-- AlterTable
ALTER TABLE "IaFinding" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "IaFindingType" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "IaFindingCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "findingTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IaFindingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IaFindingCategory_name_key" ON "IaFindingCategory"("name");

-- AddForeignKey
ALTER TABLE "IaFindingCategory" ADD CONSTRAINT "IaFindingCategory_findingTypeId_fkey" FOREIGN KEY ("findingTypeId") REFERENCES "IaFindingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IaFindingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Aliases so the tracker's other spelling of the impact level matches too.
UPDATE "IaFindingType" SET "aliases" = ARRAY['Compliance (AZDHS)', 'Compliance', 'AZDHS'] WHERE "name" = 'AZDHS Compliance';

-- From the 5th St production tracker (Key and Facility columns).
INSERT INTO "IaFacility" ("id", "name", "aliases") VALUES (gen_random_uuid()::text, '5th St', ARRAY['5th Street']);

INSERT INTO "IaDepartment" ("id", "name") VALUES
  (gen_random_uuid()::text, 'AD of Extraction'),
  (gen_random_uuid()::text, 'Canamo'),
  (gen_random_uuid()::text, 'Charlies'),
  (gen_random_uuid()::text, 'Cultivation'),
  (gen_random_uuid()::text, 'Dry Cure'),
  (gen_random_uuid()::text, 'Harvest Operations Team'),
  (gen_random_uuid()::text, 'Inventory'),
  (gen_random_uuid()::text, 'Packaging - Extraction'),
  (gen_random_uuid()::text, 'Packaging - SR Flower'),
  (gen_random_uuid()::text, 'Post Production Extraction'),
  (gen_random_uuid()::text, 'Pre Production Extraction'),
  (gen_random_uuid()::text, 'Propagation'),
  (gen_random_uuid()::text, 'Trim');

-- The standard finding categories from the tracker's Key tab, each tied to its
-- impact level (finding type). Wording is the Key's, with obvious typos fixed.
INSERT INTO "IaFindingCategory" ("id", "name", "findingTypeId", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Variances between systematic and physical counts', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 1),
  (gen_random_uuid()::text, 'Wrong room - Needs updating', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 2),
  (gen_random_uuid()::text, 'Wrong #tag - Needs updating', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 3),
  (gen_random_uuid()::text, 'Wrong status - Needs updating', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 4),
  (gen_random_uuid()::text, 'Unlabeled product (Inventory label completely missing)', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 5),
  (gen_random_uuid()::text, 'Incorrect information on label - license, batch, PID, batch #, and weight/qty.', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 6),
  (gen_random_uuid()::text, 'Incorrect information on handwritten labels (e.g. Dutchie, physical and label match but handwritten information incorrect such as DCO bins and Post extraction tape)', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 7),
  (gen_random_uuid()::text, 'Post Extraction - Missing shelf tags. Must have product label.', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 8),
  (gen_random_uuid()::text, 'IOC error - Wrong batch, PID, or product written in', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 9),
  (gen_random_uuid()::text, 'Distro staging error - same batch staged in multiple places', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 10),
  (gen_random_uuid()::text, 'Distro staging error - 2 line items for same batch. Needs to be combined. Counts ok.', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 11),
  (gen_random_uuid()::text, 'Cultivation - label unreadable.', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 12),
  (gen_random_uuid()::text, 'No Case counts on bulk finished product', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 13),
  (gen_random_uuid()::text, 'Product not at correct facility, not taken on manifest or wrong product taken.', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 14),
  (gen_random_uuid()::text, 'Product name does not match strain name', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 15),
  (gen_random_uuid()::text, 'Missing/incorrect harvest date or expiration date', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 16),
  (gen_random_uuid()::text, 'Distro - Physical quantity is below Available', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 17),
  (gen_random_uuid()::text, 'Distro - Physical quantity is above Quantity (Including Allocated)', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 18),
  (gen_random_uuid()::text, 'Distro - IOC Error - Physical and Dutchie match, IOC is off', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 19),
  (gen_random_uuid()::text, 'Distro - Count Discrepancy - IOC, Dutchie and Physical do not match', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'AZDHS Compliance'), 20),
  (gen_random_uuid()::text, 'Dutchie naming convention (multiple naming conventions for same product in Dutchie)', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 21),
  (gen_random_uuid()::text, 'FLC plant count does not match plant count in Dutchie', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 22),
  (gen_random_uuid()::text, 'Cultivation - Plant count does not match Dutchie', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 23),
  (gen_random_uuid()::text, 'Cultivation - Clone count does not match Dutchie', (SELECT "id" FROM "IaFindingType" WHERE "name" = 'Internal Process'), 24);
