-- The kiosk now identifies people by PIN alone (no name picker), so the PIN
-- must be globally unique and directly lookup-able. That replaces the
-- per-row salted hash with a keyed digest behind a unique index. Existing
-- PINs can't be converted (a salted hash can't be turned into the new
-- digest), so anyone who had one sets a new PIN at the kiosk.

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "pinHash",
ADD COLUMN     "pinDigest" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_pinDigest_key" ON "Employee"("pinDigest");
