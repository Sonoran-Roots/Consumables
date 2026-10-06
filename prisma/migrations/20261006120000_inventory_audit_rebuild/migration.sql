-- Rebuilt audit workflow: an Audit Manager level, label details on audit lines,
-- several findings per line, and findings that carry the flagged field, what the
-- system says vs. what was found, review state and adjustment tracking.

CREATE TYPE "IaAdjustmentStatus" AS ENUM ('NOT_NEEDED', 'PENDING', 'APPLIED');
CREATE TYPE "IaAdjustmentTarget" AS ENUM ('SYSTEM', 'LABEL', 'BOTH');
ALTER TYPE "AuditRole" ADD VALUE 'AUDIT_MANAGER';

-- Findings: new columns first (including the new line link) ...
ALTER TABLE "IaFinding" ADD COLUMN     "adjustedAt" TIMESTAMP(3),
ADD COLUMN     "adjustedById" TEXT,
ADD COLUMN     "adjustmentNote" TEXT,
ADD COLUMN     "adjustmentStatus" "IaAdjustmentStatus" NOT NULL DEFAULT 'NOT_NEEDED',
ADD COLUMN     "adjustmentTarget" "IaAdjustmentTarget",
ADD COLUMN     "auditLineId" TEXT,
ADD COLUMN     "flaggedField" TEXT,
ADD COLUMN     "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "foundValue" TEXT,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "systemValue" TEXT;

ALTER TABLE "IaAuditLine" ADD COLUMN     "allocatedQty" DOUBLE PRECISION,
ADD COLUMN     "expirationDate" TEXT,
ADD COLUMN     "harvestDate" TEXT,
ADD COLUMN     "itemStatus" TEXT,
ADD COLUMN     "labelVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manufactureDate" TEXT;

CREATE INDEX "IaFinding_auditLineId_idx" ON "IaFinding"("auditLineId");
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_auditLineId_fkey" FOREIGN KEY ("auditLineId") REFERENCES "IaAuditLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ... then carry existing audit findings over to the new link (they come from
-- the earlier one-finding-per-line version, and still need an audit manager's
-- review and an adjustment decision) ...
UPDATE "IaFinding" f
SET "auditLineId" = l."id", "needsReview" = true, "adjustmentStatus" = 'PENDING', "foundAt" = f."createdAt"
FROM "IaAuditLine" l
WHERE l."findingId" = f."id";

-- ... and only then drop the old one-to-one link.
ALTER TABLE "IaAuditLine" DROP CONSTRAINT "IaAuditLine_findingId_fkey";
DROP INDEX "IaAuditLine_findingId_key";
ALTER TABLE "IaAuditLine" DROP COLUMN "findingId";
