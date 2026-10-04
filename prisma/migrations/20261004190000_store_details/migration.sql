-- Store registration details: address, phone, and who holds the key.

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "keyHolderName" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "keyHolderPhone" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "notes" TEXT;
