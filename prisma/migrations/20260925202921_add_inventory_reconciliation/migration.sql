-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "InventoryReconciliation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationLine" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "beginningQty" DOUBLE PRECISION NOT NULL,
    "endingQty" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "endingValue" DOUBLE PRECISION,
    "purchasedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferInQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferInValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferOutQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferOutValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discrepancyQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usageRatePerDay" DOUBLE PRECISION,

    CONSTRAINT "ReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryReconciliation_siteId_periodStart_idx" ON "InventoryReconciliation"("siteId", "periodStart");

-- CreateIndex
CREATE INDEX "ReconciliationLine_reconciliationId_idx" ON "ReconciliationLine"("reconciliationId");

-- CreateIndex
CREATE INDEX "ReconciliationLine_itemId_idx" ON "ReconciliationLine"("itemId");

-- AddForeignKey
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLine" ADD CONSTRAINT "ReconciliationLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "InventoryReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLine" ADD CONSTRAINT "ReconciliationLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
