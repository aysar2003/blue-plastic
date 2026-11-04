-- Optional class dimension (Phase 11.12). One name on a journal line so
-- profit and loss can be read by shop, site, or department.

CREATE TABLE "tracking_categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tracking_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tracking_categories_orgId_name_key" ON "tracking_categories"("orgId", "name");
CREATE UNIQUE INDEX "tracking_categories_id_orgId_key" ON "tracking_categories"("id", "orgId");
CREATE INDEX "tracking_categories_orgId_isActive_idx" ON "tracking_categories"("orgId", "isActive");

ALTER TABLE "tracking_categories" ADD CONSTRAINT "tracking_categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_lines" ADD COLUMN "trackingCategoryId" TEXT;
CREATE INDEX "journal_lines_orgId_trackingCategoryId_idx" ON "journal_lines"("orgId", "trackingCategoryId");
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_trackingCategoryId_fkey" FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_tracking_category_org_fkey" FOREIGN KEY ("trackingCategoryId", "orgId") REFERENCES "tracking_categories"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_documents" ADD COLUMN "trackingCategoryId" TEXT;
CREATE INDEX "sales_documents_orgId_trackingCategoryId_idx" ON "sales_documents"("orgId", "trackingCategoryId");
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_trackingCategoryId_fkey" FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_tracking_category_org_fkey" FOREIGN KEY ("trackingCategoryId", "orgId") REFERENCES "tracking_categories"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_documents" ADD COLUMN "trackingCategoryId" TEXT;
CREATE INDEX "purchase_documents_orgId_trackingCategoryId_idx" ON "purchase_documents"("orgId", "trackingCategoryId");
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_trackingCategoryId_fkey" FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_tracking_category_org_fkey" FOREIGN KEY ("trackingCategoryId", "orgId") REFERENCES "tracking_categories"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tracking_categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "tracking_categories";
CREATE POLICY erp_no_direct_access ON "tracking_categories" FOR ALL USING (false) WITH CHECK (false);
