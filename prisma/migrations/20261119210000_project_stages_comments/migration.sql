-- Custom kanban columns + string stages + project chatter.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "boardStages" JSONB;

-- ProjectTask.stage was enum ProjectTaskStage → free-form key for custom columns.
ALTER TABLE "project_tasks" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "project_tasks"
  ALTER COLUMN "stage" TYPE VARCHAR(40)
  USING ("stage"::text);
ALTER TABLE "project_tasks" ALTER COLUMN "stage" SET DEFAULT 'TODO';

CREATE TABLE IF NOT EXISTS "project_comments" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_comments_orgId_projectId_createdAt_idx"
  ON "project_comments"("orgId", "projectId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_comments_orgId_fkey'
  ) THEN
    ALTER TABLE "project_comments"
      ADD CONSTRAINT "project_comments_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_comments_projectId_fkey'
  ) THEN
    ALTER TABLE "project_comments"
      ADD CONSTRAINT "project_comments_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_comments_authorId_fkey'
  ) THEN
    ALTER TABLE "project_comments"
      ADD CONSTRAINT "project_comments_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
