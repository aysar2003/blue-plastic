-- Personal / team To-do checklist (Odoo-style). Does not touch the ledger.
CREATE TABLE "workspace_todos" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATE,
    "doneAt" TIMESTAMPTZ(6),
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_todos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_todos_orgId_userId_doneAt_sequence_idx" ON "workspace_todos"("orgId", "userId", "doneAt", "sequence");
CREATE INDEX "workspace_todos_orgId_assigneeId_doneAt_idx" ON "workspace_todos"("orgId", "assigneeId", "doneAt");

ALTER TABLE "workspace_todos" ADD CONSTRAINT "workspace_todos_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_todos" ADD CONSTRAINT "workspace_todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_todos" ADD CONSTRAINT "workspace_todos_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_todos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "workspace_todos";
CREATE POLICY erp_no_direct_access ON "workspace_todos" FOR ALL USING (false) WITH CHECK (false);
