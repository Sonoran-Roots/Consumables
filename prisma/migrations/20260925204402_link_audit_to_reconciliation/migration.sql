-- AlterTable
ALTER TABLE "InventoryReconciliation" ADD COLUMN     "auditId" TEXT;

-- CreateIndex
CREATE INDEX "InventoryReconciliation_auditId_idx" ON "InventoryReconciliation"("auditId");

-- AddForeignKey
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
