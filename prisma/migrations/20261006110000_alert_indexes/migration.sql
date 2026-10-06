-- Partial indexes for the header alert queries (AppShell stock and balance bells).
--
-- Prisma does not model partial indexes here (same as "stores_one_office"), so
-- they live only in this hand-written migration. `prisma migrate diff` ignores
-- partial indexes, so it will not try to drop them.
--
-- Plain CREATE INDEX (not CONCURRENTLY): Prisma runs a migration in a
-- transaction, and both tables are small, so the lock is momentary.

-- Stock alerts: active inventory items for one organisation.
CREATE INDEX IF NOT EXISTS "items_orgId_inventory_live_idx"
  ON "items" ("orgId")
  WHERE "type" = 'INVENTORY' AND "deletedAt" IS NULL;

-- Balance alerts: active customers with a 3, 5, or 7 day reminder.
CREATE INDEX IF NOT EXISTS "customers_orgId_balance_reminder_idx"
  ON "customers" ("orgId")
  WHERE "isActive" = true AND "reminderDays" IN (3, 5, 7);
