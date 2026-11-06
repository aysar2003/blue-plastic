-- Year archive: keep newest 5 fiscal years live; older locked years may be
-- packaged into year_archive_blobs and purged from the hot journal table.

CREATE TABLE IF NOT EXISTS "year_archive_blobs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_archive_blobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "year_archive_blobs_orgId_year_idx"
  ON "year_archive_blobs"("orgId", "year");

DO $$ BEGIN
  ALTER TABLE "year_archive_blobs"
    ADD CONSTRAINT "year_archive_blobs_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "fiscal_years" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ(6);
ALTER TABLE "fiscal_years" ADD COLUMN IF NOT EXISTS "archiveChecksum" TEXT;
ALTER TABLE "fiscal_years" ADD COLUMN IF NOT EXISTS "archiveBlobId" TEXT;
ALTER TABLE "fiscal_years" ADD COLUMN IF NOT EXISTS "archiveBridgeJournalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_years_archiveBlobId_key"
  ON "fiscal_years"("archiveBlobId");

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_years_archiveBridgeJournalId_key"
  ON "fiscal_years"("archiveBridgeJournalId");

CREATE INDEX IF NOT EXISTS "fiscal_years_orgId_archivedAt_idx"
  ON "fiscal_years"("orgId", "archivedAt");

DO $$ BEGIN
  ALTER TABLE "fiscal_years"
    ADD CONSTRAINT "fiscal_years_archiveBlobId_fkey"
    FOREIGN KEY ("archiveBlobId") REFERENCES "year_archive_blobs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
