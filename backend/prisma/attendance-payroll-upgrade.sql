-- Additive, repeatable upgrade for existing installations. Back up first.
-- Run before starting the new API. No attendance is automatically confirmed.
BEGIN;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "baseSalary" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Employee_userId_fkey') THEN
    ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInLat" DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInLng" DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInAccuracy" DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInHubId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

ALTER TABLE "Salary" ADD COLUMN IF NOT EXISTS "absenceDays" INTEGER;
ALTER TABLE "Salary" ADD COLUMN IF NOT EXISTS "employeeName" TEXT;
ALTER TABLE "Salary" ADD COLUMN IF NOT EXISTS "employeeRole" TEXT;
ALTER TABLE "Salary" ADD COLUMN IF NOT EXISTS "hubName" TEXT;

CREATE TABLE IF NOT EXISTS "AttendanceAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "attendanceId" TEXT NOT NULL REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AttendanceAudit_attendanceId_idx" ON "AttendanceAudit"("attendanceId");

-- Preserve the last known monthly salary instead of assuming a default salary.
UPDATE "Employee" e SET "baseSalary" = recent."baseSalary"
FROM (SELECT DISTINCT ON ("employeeId") "employeeId", "baseSalary" FROM "Salary" ORDER BY "employeeId", "year" DESC, "month" DESC) recent
WHERE e.id = recent."employeeId" AND e."baseSalary" = 0;

-- Legacy payslips had no identity snapshot. Preserve currently recorded identity.
UPDATE "Salary" s SET "employeeName" = e.name, "employeeRole" = e.role,
  "hubName" = COALESCE(h.name, 'Unassigned')
FROM "Employee" e LEFT JOIN "Hub" h ON h.id = e."hubId"
WHERE s."employeeId" = e.id AND s."employeeName" IS NULL AND s.status = 'PAID';
COMMIT;
