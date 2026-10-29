-- Odoo-style Knowledge: Workspace/Private, nesting, favorites.
CREATE TYPE "KnowledgeScope" AS ENUM ('WORKSPACE', 'PRIVATE');

ALTER TABLE "knowledge_articles"
  ADD COLUMN "scope" "KnowledgeScope" NOT NULL DEFAULT 'WORKSPACE',
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "knowledge_articles_orgId_scope_parentId_sequence_idx"
  ON "knowledge_articles"("orgId", "scope", "parentId", "sequence");
CREATE INDEX "knowledge_articles_orgId_ownerId_scope_idx"
  ON "knowledge_articles"("orgId", "ownerId", "scope");

ALTER TABLE "knowledge_articles"
  ADD CONSTRAINT "knowledge_articles_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_articles"
  ADD CONSTRAINT "knowledge_articles_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "knowledge_favorites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_favorites_userId_articleId_key"
  ON "knowledge_favorites"("userId", "articleId");
CREATE INDEX "knowledge_favorites_orgId_userId_idx"
  ON "knowledge_favorites"("orgId", "userId");

ALTER TABLE "knowledge_favorites"
  ADD CONSTRAINT "knowledge_favorites_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_favorites"
  ADD CONSTRAINT "knowledge_favorites_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_favorites"
  ADD CONSTRAINT "knowledge_favorites_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_favorites" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "knowledge_favorites";
CREATE POLICY erp_no_direct_access ON "knowledge_favorites" FOR ALL USING (false) WITH CHECK (false);
