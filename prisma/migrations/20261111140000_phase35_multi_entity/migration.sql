-- Phase 35: ownership % on sub-companies + intercompany journal matches.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "ownershipPercent" DECIMAL(7,4) NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS "intercompany_matches" (
    "id" TEXT NOT NULL,
    "rootOrgId" TEXT NOT NULL,
    "journalAId" TEXT NOT NULL,
    "journalBId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "matchedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "intercompany_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intercompany_matches_journalAId_key"
  ON "intercompany_matches"("journalAId");
CREATE UNIQUE INDEX IF NOT EXISTS "intercompany_matches_journalBId_key"
  ON "intercompany_matches"("journalBId");
CREATE INDEX IF NOT EXISTS "intercompany_matches_rootOrgId_matchedAt_idx"
  ON "intercompany_matches"("rootOrgId", "matchedAt" DESC);

DO $$ BEGIN
  ALTER TABLE "intercompany_matches" ADD CONSTRAINT "intercompany_matches_rootOrgId_fkey"
    FOREIGN KEY ("rootOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "intercompany_matches" ADD CONSTRAINT "intercompany_matches_journalAId_fkey"
    FOREIGN KEY ("journalAId") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "intercompany_matches" ADD CONSTRAINT "intercompany_matches_journalBId_fkey"
    FOREIGN KEY ("journalBId") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
