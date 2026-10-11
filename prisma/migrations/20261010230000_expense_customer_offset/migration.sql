-- Expenses may be settled against a customer receivable (buy from their shop /
-- pay a cost by deducting what they owe), not only from a bank account.

ALTER TABLE "purchase_documents"
  ADD COLUMN "offsetCustomerId" TEXT;

ALTER TABLE "purchase_documents"
  ADD CONSTRAINT "purchase_documents_offsetCustomerId_fkey"
  FOREIGN KEY ("offsetCustomerId") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "purchase_documents_orgId_offsetCustomerId_date_idx"
  ON "purchase_documents"("orgId", "offsetCustomerId", "date" DESC);

-- An expense is paid at once: from a money account, or by reducing a customer's balance.
ALTER TABLE purchase_documents
  DROP CONSTRAINT IF EXISTS purchase_documents_payment_required;
ALTER TABLE purchase_documents
  ADD CONSTRAINT purchase_documents_payment_required
  CHECK (
    type <> 'EXPENSE'
    OR status = 'DRAFT'
    OR "paymentAccountId" IS NOT NULL
    OR "offsetCustomerId" IS NOT NULL
  );
