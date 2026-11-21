ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "startDate" DATE;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "parentTaskId" TEXT;

CREATE INDEX IF NOT EXISTS "project_tasks_parentTaskId_idx" ON "project_tasks"("parentTaskId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_parentTaskId_fkey'
  ) THEN
    ALTER TABLE "project_tasks"
      ADD CONSTRAINT "project_tasks_parentTaskId_fkey"
      FOREIGN KEY ("parentTaskId") REFERENCES "project_tasks"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "project_task_dependencies" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "predecessorId" TEXT NOT NULL,
  "successorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_task_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_task_dependencies_predecessorId_successorId_key"
  ON "project_task_dependencies"("predecessorId", "successorId");
CREATE INDEX IF NOT EXISTS "project_task_dependencies_orgId_successorId_idx"
  ON "project_task_dependencies"("orgId", "successorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_task_dependencies_orgId_fkey'
  ) THEN
    ALTER TABLE "project_task_dependencies"
      ADD CONSTRAINT "project_task_dependencies_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_task_dependencies_predecessorId_fkey'
  ) THEN
    ALTER TABLE "project_task_dependencies"
      ADD CONSTRAINT "project_task_dependencies_predecessorId_fkey"
      FOREIGN KEY ("predecessorId") REFERENCES "project_tasks"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_task_dependencies_successorId_fkey'
  ) THEN
    ALTER TABLE "project_task_dependencies"
      ADD CONSTRAINT "project_task_dependencies_successorId_fkey"
      FOREIGN KEY ("successorId") REFERENCES "project_tasks"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
