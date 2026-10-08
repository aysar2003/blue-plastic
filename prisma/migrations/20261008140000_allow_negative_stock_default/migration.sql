-- Selling ahead of receipt is the default for tills and invoices; a later bill fills the shelf.
ALTER TABLE "organizations" ALTER COLUMN "allowNegativeStock" SET DEFAULT true;
UPDATE "organizations" SET "allowNegativeStock" = true WHERE "allowNegativeStock" = false;
