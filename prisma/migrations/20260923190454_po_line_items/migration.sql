/*
  Warnings:

  - You are about to drop the column `qtyOrdered` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `startingValue` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the `PurchaseOrderReceipt` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PurchaseOrderReceipt" DROP CONSTRAINT "PurchaseOrderReceipt_purchaseOrderId_fkey";

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "purchaseOrderLineId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "qtyOrdered",
DROP COLUMN "startingValue",
ADD COLUMN     "notes" TEXT;

-- DropTable
DROP TABLE "PurchaseOrderReceipt";

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityOrdered" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_purchaseOrderLineId_idx" ON "InventoryTransaction"("purchaseOrderLineId");

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
