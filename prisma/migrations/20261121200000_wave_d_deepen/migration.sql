-- Wave D deepen: IC elimination journals, close second approver entity type.

ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'IC_ELIMINATION_DEBIT';
ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'IC_ELIMINATION_CREDIT';
ALTER TYPE "ApprovalEntityType" ADD VALUE IF NOT EXISTS 'ACCOUNTING_PERIOD';

ALTER TABLE "intercompany_matches" ADD COLUMN IF NOT EXISTS "elimJournalAId" TEXT;
ALTER TABLE "intercompany_matches" ADD COLUMN IF NOT EXISTS "elimJournalBId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "intercompany_matches_elimJournalAId_key"
  ON "intercompany_matches"("elimJournalAId");
CREATE UNIQUE INDEX IF NOT EXISTS "intercompany_matches_elimJournalBId_key"
  ON "intercompany_matches"("elimJournalBId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'intercompany_matches_elimJournalAId_fkey'
  ) THEN
    ALTER TABLE "intercompany_matches"
      ADD CONSTRAINT "intercompany_matches_elimJournalAId_fkey"
      FOREIGN KEY ("elimJournalAId") REFERENCES "journals"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'intercompany_matches_elimJournalBId_fkey'
  ) THEN
    ALTER TABLE "intercompany_matches"
      ADD CONSTRAINT "intercompany_matches_elimJournalBId_fkey"
      FOREIGN KEY ("elimJournalBId") REFERENCES "journals"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
