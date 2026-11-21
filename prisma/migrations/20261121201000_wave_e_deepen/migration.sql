-- Wave E deepen: adjacent verticals (menu food-cost period, NGO receipt,
-- agriculture season class, marketplace seller bills, patronage equity,
-- education fee waiver, hospital claim remittance).

ALTER TYPE "EquityEventKind" ADD VALUE IF NOT EXISTS 'PATRONAGE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientClaimStatus') THEN
    CREATE TYPE "PatientClaimStatus" AS ENUM ('OPEN', 'SUBMITTED', 'PAID', 'DENIED');
  END IF;
END $$;

ALTER TABLE "equity_events" ALTER COLUMN "bankAccountId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "equity_events_orgId_kind_idx" ON "equity_events"("orgId", "kind");

ALTER TABLE "item_lots" ADD COLUMN IF NOT EXISTS "trackingCategoryId" TEXT;
ALTER TABLE "item_lots" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "item_lots_trackingCategoryId_idx" ON "item_lots"("trackingCategoryId");
CREATE INDEX IF NOT EXISTS "item_lots_projectId_idx" ON "item_lots"("projectId");

ALTER TABLE "donor_pledges" ADD COLUMN IF NOT EXISTS "receiptNote" TEXT;

ALTER TABLE "patient_visits" ADD COLUMN IF NOT EXISTS "claimStatus" "PatientClaimStatus";
UPDATE "patient_visits" SET "claimStatus" = 'SUBMITTED' WHERE "claimStatus" IS NULL AND "claimsExportedAt" IS NOT NULL;
UPDATE "patient_visits" SET "claimStatus" = 'OPEN' WHERE "claimStatus" IS NULL;
ALTER TABLE "patient_visits" ALTER COLUMN "claimStatus" SET DEFAULT 'OPEN';
ALTER TABLE "patient_visits" ALTER COLUMN "claimStatus" SET NOT NULL;
ALTER TABLE "patient_visits" ADD COLUMN IF NOT EXISTS "remittanceNote" TEXT;
ALTER TABLE "patient_visits" ADD COLUMN IF NOT EXISTS "remittancePaymentId" TEXT;
CREATE INDEX IF NOT EXISTS "patient_visits_orgId_claimStatus_idx" ON "patient_visits"("orgId", "claimStatus");
CREATE INDEX IF NOT EXISTS "patient_visits_remittancePaymentId_idx" ON "patient_visits"("remittancePaymentId");

CREATE TABLE IF NOT EXISTS "settlement_seller_lines" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "grossSales" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "commission" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "sellerPayable" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "purchaseDocumentId" TEXT,
  "billPaymentId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "settlement_seller_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "settlement_seller_lines_orgId_batchId_idx" ON "settlement_seller_lines"("orgId", "batchId");
CREATE INDEX IF NOT EXISTS "settlement_seller_lines_vendorId_idx" ON "settlement_seller_lines"("vendorId");
CREATE INDEX IF NOT EXISTS "settlement_seller_lines_purchaseDocumentId_idx" ON "settlement_seller_lines"("purchaseDocumentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'item_lots_trackingCategoryId_fkey'
  ) THEN
    ALTER TABLE "item_lots"
      ADD CONSTRAINT "item_lots_trackingCategoryId_fkey"
      FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'item_lots_projectId_fkey'
  ) THEN
    ALTER TABLE "item_lots"
      ADD CONSTRAINT "item_lots_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_visits_remittancePaymentId_fkey'
  ) THEN
    ALTER TABLE "patient_visits"
      ADD CONSTRAINT "patient_visits_remittancePaymentId_fkey"
      FOREIGN KEY ("remittancePaymentId") REFERENCES "customer_payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlement_seller_lines_orgId_fkey'
  ) THEN
    ALTER TABLE "settlement_seller_lines"
      ADD CONSTRAINT "settlement_seller_lines_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlement_seller_lines_batchId_fkey'
  ) THEN
    ALTER TABLE "settlement_seller_lines"
      ADD CONSTRAINT "settlement_seller_lines_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "settlement_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlement_seller_lines_vendorId_fkey'
  ) THEN
    ALTER TABLE "settlement_seller_lines"
      ADD CONSTRAINT "settlement_seller_lines_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlement_seller_lines_purchaseDocumentId_fkey'
  ) THEN
    ALTER TABLE "settlement_seller_lines"
      ADD CONSTRAINT "settlement_seller_lines_purchaseDocumentId_fkey"
      FOREIGN KEY ("purchaseDocumentId") REFERENCES "purchase_documents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlement_seller_lines_billPaymentId_fkey'
  ) THEN
    ALTER TABLE "settlement_seller_lines"
      ADD CONSTRAINT "settlement_seller_lines_billPaymentId_fkey"
      FOREIGN KEY ("billPaymentId") REFERENCES "bill_payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
