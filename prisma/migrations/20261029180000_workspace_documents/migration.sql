-- Company file library (Odoo Documents). Does not touch the ledger.
CREATE TABLE "workspace_documents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_documents_orgId_createdAt_idx" ON "workspace_documents"("orgId", "createdAt");
CREATE INDEX "workspace_documents_orgId_title_idx" ON "workspace_documents"("orgId", "title");

ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "workspace_documents";
CREATE POLICY erp_no_direct_access ON "workspace_documents" FOR ALL USING (false) WITH CHECK (false);
