-- Projects 100/100 wave fields
ALTER TABLE "project_time_entries" ADD COLUMN IF NOT EXISTS "costRate" DECIMAL(19,4);

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "trackingCategoryId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "currencyCode" CHAR(3);

ALTER TABLE "sales_document_lines" ADD COLUMN IF NOT EXISTS "sourceTimeEntryId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_document_lines_sourceTimeEntryId_key" ON "sales_document_lines"("sourceTimeEntryId");
CREATE INDEX IF NOT EXISTS "projects_trackingCategoryId_idx" ON "projects"("trackingCategoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_trackingCategoryId_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_trackingCategoryId_fkey"
      FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_document_lines_sourceTimeEntryId_fkey'
  ) THEN
    ALTER TABLE "sales_document_lines"
      ADD CONSTRAINT "sales_document_lines_sourceTimeEntryId_fkey"
      FOREIGN KEY ("sourceTimeEntryId") REFERENCES "project_time_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
