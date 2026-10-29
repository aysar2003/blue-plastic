-- Internal wiki (Odoo Knowledge). Does not touch the ledger.
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_articles_orgId_updatedAt_idx" ON "knowledge_articles"("orgId", "updatedAt");
CREATE INDEX "knowledge_articles_orgId_title_idx" ON "knowledge_articles"("orgId", "title");

ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_articles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "knowledge_articles";
CREATE POLICY erp_no_direct_access ON "knowledge_articles" FOR ALL USING (false) WITH CHECK (false);
