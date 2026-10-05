-- Access to the separate Inventory Audit module, per user.
CREATE TYPE "AuditRole" AS ENUM ('AUDITOR', 'MANAGER', 'ADMIN');

ALTER TABLE "User" ADD COLUMN "auditRole" "AuditRole";

-- Rollout: everyone keeps Consumable Management as-is (no change to role /
-- isPurchasingTeam); existing admins of that module also get Audit as Admin
-- so someone can assign everyone else. Nobody else gets Audit access.
UPDATE "User" SET "auditRole" = 'ADMIN' WHERE "role" = 'ADMIN' AND "isPurchasingTeam" = true;
