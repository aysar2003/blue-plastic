-- Payment promise + un-overdue on invoices (collections).
ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "promisedDate" DATE;
ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "promiseNote" TEXT;
ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "excludeFromOverdue" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "sales_documents_orgId_promisedDate_idx"
  ON "sales_documents"("orgId", "promisedDate");

CREATE INDEX IF NOT EXISTS "sales_documents_orgId_excludeFromOverdue_idx"
  ON "sales_documents"("orgId", "excludeFromOverdue");
