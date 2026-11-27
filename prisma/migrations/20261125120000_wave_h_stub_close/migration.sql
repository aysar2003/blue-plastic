-- Wave H: planning timesheets for employees without login + job P&L cost vs charge.

ALTER TABLE "project_time_entries" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "project_time_entries" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;

CREATE INDEX IF NOT EXISTS "project_time_entries_orgId_employeeId_idx"
  ON "project_time_entries"("orgId", "employeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_time_entries_employeeId_fkey'
  ) THEN
    ALTER TABLE "project_time_entries"
      ADD CONSTRAINT "project_time_entries_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- At least one of userId / employeeId must identify who worked.
ALTER TABLE "project_time_entries" DROP CONSTRAINT IF EXISTS project_time_entries_worker_present;
ALTER TABLE "project_time_entries"
  ADD CONSTRAINT project_time_entries_worker_present
  CHECK ("userId" IS NOT NULL OR "employeeId" IS NOT NULL);
