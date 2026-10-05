-- CreateTable
CREATE TABLE "IaCoverage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IaCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IaEmailTemplate" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "footer" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IaEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IaCoverage_userId_idx" ON "IaCoverage"("userId");

-- AddForeignKey
ALTER TABLE "IaCoverage" ADD CONSTRAINT "IaCoverage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaCoverage" ADD CONSTRAINT "IaCoverage_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "IaFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IaCoverage" ADD CONSTRAINT "IaCoverage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "IaDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A coverage row must name a facility, a department, or both.
ALTER TABLE "IaCoverage" ADD CONSTRAINT "IaCoverage_needs_facility_or_department"
  CHECK ("facilityId" IS NOT NULL OR "departmentId" IS NOT NULL);

-- Default wording for the findings email (editable in settings).
INSERT INTO "IaEmailTemplate" ("id", "subject", "intro", "footer", "updatedAt") VALUES (
  'default',
  'Inventory audit findings for your team — {count} to review ({date})',
  E'Hi {managerName},\n\nThe inventory audit team found {count} item(s) that need your team''s attention. Please review each one, correct it, and let us know when it is done. You can also update a finding''s status directly in the audit tracker: {reportLink}\n',
  E'Thank you,\n{senderName}\nInventory Audit Team',
  CURRENT_TIMESTAMP
);
