-- Which store a movement, a sale line, or a purchase line belongs to.
-- Null means the movement was recorded before stores. Those quantities are
-- shown on the office store. The running on-hand total is unchanged.

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "isOffice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "sales_document_lines" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "purchase_document_lines" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "stores_one_office" ON "stores"("orgId") WHERE "isOffice" = true;
CREATE INDEX IF NOT EXISTS "inventory_transactions_orgId_itemId_storeId_idx" ON "inventory_transactions"("orgId", "itemId", "storeId");
CREATE INDEX IF NOT EXISTS "sales_document_lines_storeId_idx" ON "sales_document_lines"("storeId");
CREATE INDEX IF NOT EXISTS "purchase_document_lines_storeId_idx" ON "purchase_document_lines"("storeId");

DO $$ BEGIN
  ALTER TABLE "inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sales_document_lines"
    ADD CONSTRAINT "sales_document_lines_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_document_lines"
    ADD CONSTRAINT "purchase_document_lines_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
