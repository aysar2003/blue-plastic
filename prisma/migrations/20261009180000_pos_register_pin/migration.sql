-- Cashier PIN on a till. Null means no PIN yet, so existing registers stay openable.
ALTER TABLE "pos_registers" ADD COLUMN "pinHash" TEXT;
