-- Hot-path indexes for POS catalog, item category filters, and project→service jobs.

CREATE INDEX IF NOT EXISTS "items_orgId_categoryId_idx"
  ON "items"("orgId", "categoryId");

CREATE INDEX IF NOT EXISTS "items_orgId_availableInPos_isActive_idx"
  ON "items"("orgId", "availableInPos", "isActive");

CREATE INDEX IF NOT EXISTS "service_jobs_orgId_projectId_idx"
  ON "service_jobs"("orgId", "projectId");
