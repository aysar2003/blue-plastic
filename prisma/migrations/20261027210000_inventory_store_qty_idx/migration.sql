-- Shelf totals group movements by item and store. Without this, a new
-- invoice or bill scans every inventory movement.
CREATE INDEX IF NOT EXISTS "inventory_transactions_orgId_itemId_storeId_idx"
  ON "inventory_transactions" ("orgId", "itemId", "storeId");
