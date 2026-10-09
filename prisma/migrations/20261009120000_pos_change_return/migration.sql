-- Change handed back at the till is an outgoing movement from a real payment account.
-- Existing sales keep changeAmount 0 and a null change account: their payment rows
-- already equal the sale, so balances and reports stay as they were.

ALTER TABLE "pos_payment_methods" ADD COLUMN "allowsChangeReturn" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "pos_registers" ADD COLUMN "defaultChangeMethodId" TEXT;
ALTER TABLE "pos_registers" ADD COLUMN "allowWalletChangeReturn" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "pos_register_methods" ADD COLUMN "allowsChangeReturn" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "pos_orders" ADD COLUMN "changeAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "pos_orders" ADD COLUMN "changePaymentMethodId" TEXT;
ALTER TABLE "pos_orders" ADD COLUMN "changeLedgerAccountId" TEXT;

CREATE INDEX "pos_orders_changePaymentMethodId_idx" ON "pos_orders"("changePaymentMethodId");
CREATE INDEX "pos_registers_defaultChangeMethodId_idx" ON "pos_registers"("defaultChangeMethodId");

ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_defaultChangeMethodId_fkey" FOREIGN KEY ("defaultChangeMethodId") REFERENCES "pos_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_changePaymentMethodId_fkey" FOREIGN KEY ("changePaymentMethodId") REFERENCES "pos_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_changeLedgerAccountId_fkey" FOREIGN KEY ("changeLedgerAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tills that already have a cash method open the Payment dialog on that account.
UPDATE "pos_registers" AS r
SET "defaultChangeMethodId" = picked.id
FROM (
  SELECT DISTINCT ON (rm."registerId") rm."registerId", m.id
  FROM "pos_register_methods" rm
  JOIN "pos_payment_methods" m ON m.id = rm."paymentMethodId"
  WHERE m.name ~* '(^|[^a-z])cash([^a-z]|$)'
  ORDER BY rm."registerId", m."sortOrder", m.name
) AS picked
WHERE r.id = picked."registerId"
  AND r."defaultChangeMethodId" IS NULL;
