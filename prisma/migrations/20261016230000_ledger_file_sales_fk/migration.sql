-- Attachments on sales documents (Phase 11.1), and FKs for purchase/sales links.

ALTER TABLE "ledger_files" ADD COLUMN IF NOT EXISTS "salesDocumentId" TEXT;

CREATE INDEX IF NOT EXISTS "ledger_files_orgId_salesDocumentId_idx" ON "ledger_files"("orgId", "salesDocumentId");

-- Purchase FK may already have rows without a constraint; add when missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_files_purchaseDocumentId_fkey'
  ) THEN
    ALTER TABLE "ledger_files"
      ADD CONSTRAINT "ledger_files_purchaseDocumentId_fkey"
      FOREIGN KEY ("purchaseDocumentId") REFERENCES "purchase_documents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_files_salesDocumentId_fkey'
  ) THEN
    ALTER TABLE "ledger_files"
      ADD CONSTRAINT "ledger_files_salesDocumentId_fkey"
      FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
