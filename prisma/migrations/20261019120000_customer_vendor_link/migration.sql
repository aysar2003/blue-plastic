-- Link a customer to the vendor that is the same trading party (and the reverse).
-- Used so Mall Group (customer) and Mall Group (supplier) share a navigable pair
-- on contact pages and statements without merging AR and AP ledgers.

ALTER TABLE "customers"
  ADD COLUMN "linkedVendorId" TEXT;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_linkedVendorId_fkey"
  FOREIGN KEY ("linkedVendorId") REFERENCES "vendors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "customers_linkedVendorId_key"
  ON "customers"("linkedVendorId");
