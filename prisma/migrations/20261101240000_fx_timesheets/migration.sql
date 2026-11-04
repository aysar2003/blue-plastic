-- Wave B1: party currencies for day-to-day FX. Wave B2: project timesheets.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "currencyCode" CHAR(3);
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "currencyCode" CHAR(3);

CREATE TABLE IF NOT EXISTS "project_time_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "hours" DECIMAL(19,4) NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "billableRate" DECIMAL(19,4),
    "invoicedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "project_time_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_time_entries_orgId_projectId_workDate_idx"
  ON "project_time_entries"("orgId", "projectId", "workDate" DESC);
CREATE INDEX IF NOT EXISTS "project_time_entries_orgId_billable_invoicedAt_idx"
  ON "project_time_entries"("orgId", "billable", "invoicedAt");

DO $$ BEGIN
  ALTER TABLE "project_time_entries"
    ADD CONSTRAINT "project_time_entries_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "project_time_entries"
    ADD CONSTRAINT "project_time_entries_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "project_time_entries"
    ADD CONSTRAINT "project_time_entries_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "project_time_entries"
    ADD CONSTRAINT "project_time_entries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
