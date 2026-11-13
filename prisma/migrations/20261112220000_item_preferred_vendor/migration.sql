-- Preferred supplier on products & services.

ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "preferredVendorId" TEXT;

CREATE INDEX IF NOT EXISTS "items_orgId_preferredVendorId_idx"
  ON "items"("orgId", "preferredVendorId");

DO $$ BEGIN
  ALTER TABLE "items"
    ADD CONSTRAINT "items_preferredVendorId_fkey"
    FOREIGN KEY ("preferredVendorId") REFERENCES "vendors"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
