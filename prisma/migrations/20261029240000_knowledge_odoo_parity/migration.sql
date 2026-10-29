-- Odoo Knowledge parity: Shared, icon/cover, lock, trash, shares, revisions.
ALTER TYPE "KnowledgeScope" ADD VALUE IF NOT EXISTS 'SHARED';

ALTER TABLE "knowledge_articles"
  ADD COLUMN IF NOT EXISTS "icon" TEXT,
  ADD COLUMN IF NOT EXISTS "coverUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "lockedById" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "knowledge_articles_orgId_deletedAt_idx"
  ON "knowledge_articles"("orgId", "deletedAt");

ALTER TABLE "knowledge_articles"
  DROP CONSTRAINT IF EXISTS "knowledge_articles_lockedById_fkey";
ALTER TABLE "knowledge_articles"
  ADD CONSTRAINT "knowledge_articles_lockedById_fkey"
  FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "knowledge_shares" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_shares_articleId_userId_key"
  ON "knowledge_shares"("articleId", "userId");
CREATE INDEX IF NOT EXISTS "knowledge_shares_orgId_userId_idx"
  ON "knowledge_shares"("orgId", "userId");

ALTER TABLE "knowledge_shares" DROP CONSTRAINT IF EXISTS "knowledge_shares_orgId_fkey";
ALTER TABLE "knowledge_shares"
  ADD CONSTRAINT "knowledge_shares_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_shares" DROP CONSTRAINT IF EXISTS "knowledge_shares_articleId_fkey";
ALTER TABLE "knowledge_shares"
  ADD CONSTRAINT "knowledge_shares_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_shares" DROP CONSTRAINT IF EXISTS "knowledge_shares_userId_fkey";
ALTER TABLE "knowledge_shares"
  ADD CONSTRAINT "knowledge_shares_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_shares" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "knowledge_shares";
CREATE POLICY erp_no_direct_access ON "knowledge_shares" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS "knowledge_revisions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_revisions_articleId_createdAt_idx"
  ON "knowledge_revisions"("articleId", "createdAt");
CREATE INDEX IF NOT EXISTS "knowledge_revisions_orgId_articleId_idx"
  ON "knowledge_revisions"("orgId", "articleId");

ALTER TABLE "knowledge_revisions" DROP CONSTRAINT IF EXISTS "knowledge_revisions_orgId_fkey";
ALTER TABLE "knowledge_revisions"
  ADD CONSTRAINT "knowledge_revisions_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_revisions" DROP CONSTRAINT IF EXISTS "knowledge_revisions_articleId_fkey";
ALTER TABLE "knowledge_revisions"
  ADD CONSTRAINT "knowledge_revisions_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_revisions" DROP CONSTRAINT IF EXISTS "knowledge_revisions_createdById_fkey";
ALTER TABLE "knowledge_revisions"
  ADD CONSTRAINT "knowledge_revisions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_revisions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "knowledge_revisions";
CREATE POLICY erp_no_direct_access ON "knowledge_revisions" FOR ALL USING (false) WITH CHECK (false);
