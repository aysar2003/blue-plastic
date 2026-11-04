-- Phase 11.4: progress invoicing from estimate / quotation / sales order
-- Phase 11.5: billable purchase lines → customer invoice

-- 11.4 — many invoices per source (drop unique convertedFromId)
DROP INDEX IF EXISTS "sales_documents_convertedFromId_key";
CREATE INDEX IF NOT EXISTS "sales_documents_convertedFromId_idx" ON "sales_documents"("convertedFromId");

ALTER TABLE "sales_document_lines"
  ADD COLUMN IF NOT EXISTS "quantityInvoiced" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- Backfill: CLOSED proposals/orders treated as fully invoiced
UPDATE "sales_document_lines" AS l
SET "quantityInvoiced" = l."quantity"
FROM "sales_documents" AS d
WHERE l."documentId" = d.id
  AND d.type IN ('ESTIMATE', 'QUOTATION', 'SALES_ORDER')
  AND d.status = 'CLOSED'
  AND l."quantityInvoiced" = 0;

-- 11.5 — billable expense lines + link from invoice line
ALTER TABLE "purchase_document_lines"
  ADD COLUMN IF NOT EXISTS "billableCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "billableUnitPrice" DECIMAL(19,4);

ALTER TABLE "sales_document_lines"
  ADD COLUMN IF NOT EXISTS "sourcePurchaseLineId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_document_lines_sourcePurchaseLineId_key"
  ON "sales_document_lines"("sourcePurchaseLineId");

CREATE INDEX IF NOT EXISTS "purchase_document_lines_orgId_billableCustomerId_idx"
  ON "purchase_document_lines"("orgId", "billableCustomerId");

DO $$ BEGIN
  ALTER TABLE "purchase_document_lines"
    ADD CONSTRAINT "purchase_document_lines_billableCustomerId_fkey"
    FOREIGN KEY ("billableCustomerId") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sales_document_lines"
    ADD CONSTRAINT "sales_document_lines_sourcePurchaseLineId_fkey"
    FOREIGN KEY ("sourcePurchaseLineId") REFERENCES "purchase_document_lines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
