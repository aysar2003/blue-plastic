-- Wave B deepen: CAPA owner/due/root-cause, SOV lines, work-center holidays.

ALTER TABLE "capa_notes" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "capa_notes" ADD COLUMN IF NOT EXISTS "dueDate" DATE;
ALTER TABLE "capa_notes" ADD COLUMN IF NOT EXISTS "rootCause" TEXT;
ALTER TABLE "capa_notes" ADD COLUMN IF NOT EXISTS "effectivenessDate" DATE;
ALTER TABLE "capa_notes" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "capa_notes" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;

CREATE INDEX IF NOT EXISTS "capa_notes_orgId_dueDate_idx" ON "capa_notes"("orgId", "dueDate");
CREATE INDEX IF NOT EXISTS "capa_notes_orgId_ownerId_idx" ON "capa_notes"("orgId", "ownerId");
CREATE INDEX IF NOT EXISTS "capa_notes_vendorId_idx" ON "capa_notes"("vendorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'capa_notes_ownerId_fkey'
  ) THEN
    ALTER TABLE "capa_notes"
      ADD CONSTRAINT "capa_notes_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'capa_notes_vendorId_fkey'
  ) THEN
    ALTER TABLE "capa_notes"
      ADD CONSTRAINT "capa_notes_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "project_sov_lines" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractId" TEXT,
    "lineNumber" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "budgetAmount" DECIMAL(19,4) NOT NULL,
    "percentComplete" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "billedPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "thisBillAmount" DECIMAL(19,4),
    "retainagePercent" DECIMAL(7,4),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "project_sov_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_sov_lines_projectId_lineNumber_key"
  ON "project_sov_lines"("projectId", "lineNumber");
CREATE INDEX IF NOT EXISTS "project_sov_lines_orgId_projectId_idx"
  ON "project_sov_lines"("orgId", "projectId");
CREATE INDEX IF NOT EXISTS "project_sov_lines_contractId_idx"
  ON "project_sov_lines"("contractId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_sov_lines_orgId_fkey'
  ) THEN
    ALTER TABLE "project_sov_lines"
      ADD CONSTRAINT "project_sov_lines_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_sov_lines_projectId_fkey'
  ) THEN
    ALTER TABLE "project_sov_lines"
      ADD CONSTRAINT "project_sov_lines_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_sov_lines_contractId_fkey'
  ) THEN
    ALTER TABLE "project_sov_lines"
      ADD CONSTRAINT "project_sov_lines_contractId_fkey"
      FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "work_center_exceptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'HOLIDAY',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "work_center_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_center_exceptions_workCenterId_date_key"
  ON "work_center_exceptions"("workCenterId", "date");
CREATE INDEX IF NOT EXISTS "work_center_exceptions_orgId_date_idx"
  ON "work_center_exceptions"("orgId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_center_exceptions_orgId_fkey'
  ) THEN
    ALTER TABLE "work_center_exceptions"
      ADD CONSTRAINT "work_center_exceptions_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_center_exceptions_workCenterId_fkey'
  ) THEN
    ALTER TABLE "work_center_exceptions"
      ADD CONSTRAINT "work_center_exceptions_workCenterId_fkey"
      FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
