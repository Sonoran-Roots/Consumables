-- Inventory audits worked through line by line, with findings documented as they're found.
-- CreateEnum
CREATE TYPE "IaAuditStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "IaLineStatus" AS ENUM ('PENDING', 'OK', 'DISCREPANCY');

-- AlterTable
ALTER TABLE "IaFinding" ADD COLUMN     "auditId" TEXT;

-- CreateTable
CREATE TABLE "IaAudit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auditType" "IaAuditType" NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "auditors" TEXT,
    "notes" TEXT,
    "sourceFile" TEXT,
    "facilityId" TEXT NOT NULL,
    "defaultDepartmentId" TEXT,
    "status" "IaAuditStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdById" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IaAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IaAuditLine" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "product" TEXT,
    "batchId" TEXT,
    "pid" TEXT,
    "strain" TEXT,
    "room" TEXT,
    "serialNo" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "systemQty" DOUBLE PRECISION,
    "actualQty" DOUBLE PRECISION,
    "status" "IaLineStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),
    "findingId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IaAuditLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IaAudit_status_idx" ON "IaAudit"("status");

-- CreateIndex
CREATE INDEX "IaAudit_facilityId_auditDate_idx" ON "IaAudit"("facilityId", "auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "IaAuditLine_findingId_key" ON "IaAuditLine"("findingId");

-- CreateIndex
CREATE INDEX "IaAuditLine_auditId_status_idx" ON "IaAuditLine"("auditId", "status");

-- CreateIndex
CREATE INDEX "IaAuditLine_auditId_room_idx" ON "IaAuditLine"("auditId", "room");

-- CreateIndex
CREATE INDEX "IaAuditLine_auditId_position_idx" ON "IaAuditLine"("auditId", "position");

-- CreateIndex
CREATE INDEX "IaFinding_auditId_idx" ON "IaFinding"("auditId");

-- AddForeignKey
ALTER TABLE "IaFinding" ADD CONSTRAINT "IaFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "IaAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAudit" ADD CONSTRAINT "IaAudit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "IaFacility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAudit" ADD CONSTRAINT "IaAudit_defaultDepartmentId_fkey" FOREIGN KEY ("defaultDepartmentId") REFERENCES "IaDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAudit" ADD CONSTRAINT "IaAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAudit" ADD CONSTRAINT "IaAudit_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAuditLine" ADD CONSTRAINT "IaAuditLine_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "IaAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAuditLine" ADD CONSTRAINT "IaAuditLine_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaAuditLine" ADD CONSTRAINT "IaAuditLine_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "IaFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

