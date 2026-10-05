-- Store-keeper fulfilment: when sale tickets were prepared for the customer.

ALTER TABLE "store_tickets" ADD COLUMN IF NOT EXISTS "preparedAt" TIMESTAMPTZ(6);
ALTER TABLE "store_tickets" ADD COLUMN IF NOT EXISTS "preparedById" TEXT;

CREATE INDEX IF NOT EXISTS "store_tickets_orgId_storeId_preparedAt_idx"
  ON "store_tickets"("orgId", "storeId", "preparedAt");
