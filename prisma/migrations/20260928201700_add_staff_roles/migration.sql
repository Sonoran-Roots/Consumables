-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('USER', 'MANAGER', 'ADMIN');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "role" "StaffRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPurchasingTeam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "StaffRole" NOT NULL DEFAULT 'USER';
