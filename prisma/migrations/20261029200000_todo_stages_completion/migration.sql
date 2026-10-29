-- Four-stage to-do workflow + completion note / report when closing.
CREATE TYPE "WorkspaceTodoStage" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'DONE');
CREATE TYPE "WorkspaceTodoCompletion" AS ENUM ('COMPLETED', 'PARTIAL', 'BLOCKED', 'REPORT');

ALTER TABLE "workspace_todos"
  ADD COLUMN IF NOT EXISTS "stage" "WorkspaceTodoStage" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "completionKind" "WorkspaceTodoCompletion",
  ADD COLUMN IF NOT EXISTS "completionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "completedById" TEXT;

UPDATE "workspace_todos"
SET "stage" = 'DONE'
WHERE "doneAt" IS NOT NULL AND "stage" = 'OPEN';

ALTER TABLE "workspace_todos"
  ADD CONSTRAINT "workspace_todos_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "workspace_todos_orgId_stage_sequence_idx"
  ON "workspace_todos"("orgId", "stage", "sequence");
