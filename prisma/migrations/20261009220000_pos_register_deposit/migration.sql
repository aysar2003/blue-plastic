-- New POS orders name the register bank account they post to.
-- Existing orders stay null, so their journals remain on the wallet accounts.

ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "depositLedgerAccountId" TEXT;

DO $$ BEGIN
  ALTER TABLE "pos_orders"
    ADD CONSTRAINT "pos_orders_depositLedgerAccountId_fkey"
    FOREIGN KEY ("depositLedgerAccountId") REFERENCES "ledger_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "pos_orders_depositLedgerAccountId_idx" ON "pos_orders"("depositLedgerAccountId");
