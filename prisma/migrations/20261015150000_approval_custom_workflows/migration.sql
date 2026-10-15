-- Named custom approval workflows: multiple rules per document family.

ALTER TABLE "approval_policies" DROP CONSTRAINT IF EXISTS "approval_policies_orgId_entityType_key";
DROP INDEX IF EXISTS "approval_policies_orgId_entityType_key";

ALTER TABLE "approval_policies" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "approval_policies" ADD COLUMN IF NOT EXISTS "maxAmount" DECIMAL(19,4);
ALTER TABLE "approval_policies" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;

-- Backfill names for existing one-per-type rows.
UPDATE "approval_policies"
SET "name" = CASE "entityType"
  WHEN 'SALES_DOCUMENT' THEN 'Sales — default'
  WHEN 'PURCHASE_DOCUMENT' THEN 'Purchases — default'
  WHEN 'CUSTOMER_PAYMENT' THEN 'Customer payments — default'
  WHEN 'BILL_PAYMENT' THEN 'Bill payments — default'
  WHEN 'JOURNAL' THEN 'Journals — default'
  WHEN 'INVENTORY_ADJUSTMENT' THEN 'Stock adjustments — default'
  WHEN 'BANK_TRANSFER' THEN 'Bank transfers — default'
  WHEN 'DEPOSIT' THEN 'Deposits — default'
  WHEN 'CUSTOMER' THEN 'Customers — default'
  WHEN 'VENDOR' THEN 'Vendors — default'
  ELSE 'Default rule'
END
WHERE "name" IS NULL OR "name" = '';

ALTER TABLE "approval_policies" ALTER COLUMN "name" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "approval_policies_orgId_entityType_enabled_priority_idx"
  ON "approval_policies"("orgId", "entityType", "enabled", "priority");
