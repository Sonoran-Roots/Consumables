-- Dutchie audit tables: the managed list of adjustment reasons, Dutchie's row id and
-- brand on audit lines, the kind of Dutchie audit, and the reason on a finding.
-- AlterTable
ALTER TABLE "IaAudit" ADD COLUMN     "dutchieType" TEXT;

-- AlterTable
ALTER TABLE "IaAuditLine" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "dutchieId" TEXT;

-- AlterTable
ALTER TABLE "IaFinding" ADD COLUMN     "adjustmentReasonId" TEXT;

-- CreateTable
CREATE TABLE "IaAdjustmentReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IaAdjustmentReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IaAdjustmentReason_name_key" ON "IaAdjustmentReason"("name");

-- CreateIndex
CREATE INDEX "IaAuditLine_auditId_dutchieId_idx" ON "IaAuditLine"("auditId", "dutchieId");

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_adjustmentReasonId_fkey" FOREIGN KEY ("adjustmentReasonId") REFERENCES "IaAdjustmentReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The adjustment reasons currently set up in Dutchie (editable in the module's settings).
INSERT INTO "IaAdjustmentReason" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Conversion Error', 1),
  (gen_random_uuid()::text, 'Moisture Loss', 2),
  (gen_random_uuid()::text, 'Packaging Variance', 3),
  (gen_random_uuid()::text, 'Inventory Reconciliation', 4),
  (gen_random_uuid()::text, 'Data Entry Error', 5),
  (gen_random_uuid()::text, 'Batch Mix up', 6),
  (gen_random_uuid()::text, 'Found Inventory', 7),
  (gen_random_uuid()::text, 'Theft', 8),
  (gen_random_uuid()::text, 'Purge Loss', 9),
  (gen_random_uuid()::text, 'Post Bucked Bin', 10),
  (gen_random_uuid()::text, 'Post Extraction Remainder', 11),
  (gen_random_uuid()::text, 'Decarb Loss', 12),
  (gen_random_uuid()::text, 'Post PreRoll Production Variance', 13),
  (gen_random_uuid()::text, 'Batch Closure', 14),
  (gen_random_uuid()::text, 'Requires Security Footage Review', 15),
  (gen_random_uuid()::text, 'Intake Variance', 16),
  (gen_random_uuid()::text, 'Machine Trim Variance', 17),
  (gen_random_uuid()::text, 'Dutchie Glitch', 18),
  (gen_random_uuid()::text, 'Post-Production Loss', 19),
  (gen_random_uuid()::text, 'Contaminated', 20),
  (gen_random_uuid()::text, 'Damaged', 21),
  (gen_random_uuid()::text, 'Failed QC', 22),
  (gen_random_uuid()::text, 'Expired', 23),
  (gen_random_uuid()::text, 'Post-Extraction Material', 24),
  (gen_random_uuid()::text, 'Post-Processing Waste', 25),
  (gen_random_uuid()::text, 'Post-Packaging Waste', 26),
  (gen_random_uuid()::text, 'Invoice Error', 27),
  (gen_random_uuid()::text, 'Counting Error', 28);
