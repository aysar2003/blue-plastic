-- Wave G deepen: Horn cash (mobile-money match hints) + statutory WHT on bills.

-- System account key for WHT payable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'SystemAccountKey' AND e.enumlabel = 'WITHHOLDING_TAX_PAYABLE'
  ) THEN
    ALTER TYPE "SystemAccountKey" ADD VALUE 'WITHHOLDING_TAX_PAYABLE';
  END IF;
END $$;

ALTER TABLE "imported_transactions"
  ADD COLUMN IF NOT EXISTS "partyRef" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedCustomerPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "suggestedInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "matchScore" DECIMAL(5, 2);

CREATE INDEX IF NOT EXISTS "imported_transactions_orgId_suggestedInvoiceId_idx"
  ON "imported_transactions"("orgId", "suggestedInvoiceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imported_transactions_matchedCustomerPaymentId_fkey'
  ) THEN
    ALTER TABLE "imported_transactions"
      ADD CONSTRAINT "imported_transactions_matchedCustomerPaymentId_fkey"
      FOREIGN KEY ("matchedCustomerPaymentId") REFERENCES "customer_payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "purchase_documents"
  ADD COLUMN IF NOT EXISTS "withholdPercent" DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "withholdAmount" DECIMAL(19, 4);
