DO $$ BEGIN
  CREATE TYPE "EmployeeLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LEFT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "EmployeeLifecycleStatus";

UPDATE "employees"
   SET "lifecycleStatus" = 'ACTIVE'
 WHERE "lifecycleStatus" IS NULL;

ALTER TABLE "employees"
  ALTER COLUMN "lifecycleStatus" SET DEFAULT 'ACTIVE';

ALTER TABLE "employees"
  ALTER COLUMN "lifecycleStatus" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "employees_orgId_lifecycleStatus_idx"
  ON "employees"("orgId", "lifecycleStatus");
