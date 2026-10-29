-- Odoo-style workspace folders for the company document library.
CREATE TABLE "workspace_document_folders" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemKey" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_document_folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_document_folders_orgId_name_key" ON "workspace_document_folders"("orgId", "name");
CREATE UNIQUE INDEX "workspace_document_folders_orgId_systemKey_key" ON "workspace_document_folders"("orgId", "systemKey");
CREATE INDEX "workspace_document_folders_orgId_sequence_idx" ON "workspace_document_folders"("orgId", "sequence");

ALTER TABLE "workspace_document_folders" ADD CONSTRAINT "workspace_document_folders_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_documents" ADD COLUMN "folderId" TEXT;

CREATE INDEX "workspace_documents_orgId_folderId_createdAt_idx" ON "workspace_documents"("orgId", "folderId", "createdAt");

ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "workspace_document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_document_folders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "workspace_document_folders";
CREATE POLICY erp_no_direct_access ON "workspace_document_folders" FOR ALL USING (false) WITH CHECK (false);
