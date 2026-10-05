-- CreateEnum
CREATE TYPE "IaAuditType" AS ENUM ('PRODUCT', 'WASTE_LOG', 'PLANT');

-- CreateEnum
CREATE TYPE "IaFindingStatus" AS ENUM ('OPEN', 'NOTIFIED', 'RESOLVED', 'VERIFIED');

-- CreateTable
CREATE TABLE "IaFacility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IaFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IaDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IaDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IaFindingType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDueDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IaFindingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IaFinding" (
    "id" TEXT NOT NULL,
    "auditType" "IaAuditType" NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "auditors" TEXT,
    "facilityId" TEXT NOT NULL,
    "findingTypeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "secondDepartmentId" TEXT,
    "description" TEXT NOT NULL,
    "product" TEXT,
    "batchId" TEXT,
    "pid" TEXT,
    "strain" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "room" TEXT,
    "serialNo" TEXT,
    "reference" TEXT,
    "weightGrams" DOUBLE PRECISION,
    "disposalDate" TIMESTAMP(3),
    "correction" TEXT,
    "monitoringNotes" TEXT,
    "status" "IaFindingStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "resolvedById" TEXT,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IaFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IaFindingEvent" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "fromStatus" "IaFindingStatus",
    "toStatus" "IaFindingStatus",
    "note" TEXT,

    CONSTRAINT "IaFindingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IaFacility_name_key" ON "IaFacility"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IaDepartment_name_key" ON "IaDepartment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IaFindingType_name_key" ON "IaFindingType"("name");

-- CreateIndex
CREATE INDEX "IaFinding_status_idx" ON "IaFinding"("status");

-- CreateIndex
CREATE INDEX "IaFinding_facilityId_idx" ON "IaFinding"("facilityId");

-- CreateIndex
CREATE INDEX "IaFinding_departmentId_idx" ON "IaFinding"("departmentId");

-- CreateIndex
CREATE INDEX "IaFinding_dueDate_idx" ON "IaFinding"("dueDate");

-- CreateIndex
CREATE INDEX "IaFinding_auditDate_idx" ON "IaFinding"("auditDate");

-- CreateIndex
CREATE INDEX "IaFindingEvent_findingId_at_idx" ON "IaFindingEvent"("findingId", "at");

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "IaFacility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_findingTypeId_fkey" FOREIGN KEY ("findingTypeId") REFERENCES "IaFindingType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "IaDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_secondDepartmentId_fkey" FOREIGN KEY ("secondDepartmentId") REFERENCES "IaDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFindingEvent" ADD CONSTRAINT "IaFindingEvent_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "IaFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaFindingEvent" ADD CONSTRAINT "IaFindingEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Starting lists, taken from the 2026 Distribution AFS tracker (Key tab and the
-- Facility / Finding Type columns). Admins can edit all of these in the
-- Inventory Audit settings; aliases are other spellings seen in the old sheets.
INSERT INTO "IaFacility" ("id", "name", "aliases") VALUES
  (gen_random_uuid()::text, 'McDowell Hub',    ARRAY['McDowell', 'McDowell - Hub']),
  (gen_random_uuid()::text, 'McDowell Distro', ARRAY['McDowell - Distro']),
  (gen_random_uuid()::text, 'Rockford',        ARRAY[]::TEXT[]);

INSERT INTO "IaDepartment" ("id", "name", "aliases") VALUES
  (gen_random_uuid()::text, '3rd Party / Subcontractor', ARRAY['3rd Party', 'Subcontractor']),
  (gen_random_uuid()::text, 'Dutchie Glitch',            ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Extraction',                ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Production Inventory',      ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Logistics',                 ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Operations Analyst',        ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Packaging Team',            ARRAY['Packaging']),
  (gen_random_uuid()::text, 'Fulfillment',               ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Intake',                    ARRAY[]::TEXT[]),
  (gen_random_uuid()::text, 'Sales Administration',      ARRAY['Sales', 'Sales Admin']);

-- Default due dates (days after the audit date) are a starting point — change
-- them in settings.
INSERT INTO "IaFindingType" ("id", "name", "defaultDueDays", "sortOrder") VALUES
  (gen_random_uuid()::text, 'AZDHS Compliance', 3, 0),
  (gen_random_uuid()::text, 'Internal Process', 7, 1);
