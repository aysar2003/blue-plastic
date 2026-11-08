-- P5: NGO pledges, project progress/retention/retainer, routing, ASN, budget fund tag

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "contractValue" DECIMAL(19,4);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "retentionPercent" DECIMAL(7,4);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "billedPercent" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "retainerAmount" DECIMAL(19,4);

ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "retentionAmount" DECIMAL(19,4);
ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "progressPercent" DECIMAL(7,4);

ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "trackingCategoryId" TEXT;
CREATE INDEX IF NOT EXISTS "budgets_trackingCategoryId_idx" ON "budgets"("trackingCategoryId");
DO $$ BEGIN
  ALTER TABLE "budgets" ADD CONSTRAINT "budgets_trackingCategoryId_fkey"
    FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TYPE "DonorPledgeStatus" AS ENUM ('PLEDGED', 'RECEIVED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "donor_pledges" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "trackingCategoryId" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "pledgedAt" DATE NOT NULL,
    "dueDate" DATE,
    "status" "DonorPledgeStatus" NOT NULL DEFAULT 'PLEDGED',
    "purpose" TEXT,
    "notes" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "donor_pledges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "donor_pledges_orgId_status_pledgedAt_idx" ON "donor_pledges"("orgId", "status", "pledgedAt" DESC);
CREATE INDEX IF NOT EXISTS "donor_pledges_customerId_idx" ON "donor_pledges"("customerId");
CREATE INDEX IF NOT EXISTS "donor_pledges_trackingCategoryId_idx" ON "donor_pledges"("trackingCategoryId");
CREATE INDEX IF NOT EXISTS "donor_pledges_paymentId_idx" ON "donor_pledges"("paymentId");

DO $$ BEGIN
  ALTER TABLE "donor_pledges" ADD CONSTRAINT "donor_pledges_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "donor_pledges" ADD CONSTRAINT "donor_pledges_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "donor_pledges" ADD CONSTRAINT "donor_pledges_trackingCategoryId_fkey"
    FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "donor_pledges" ADD CONSTRAINT "donor_pledges_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "customer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "routing_steps" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "minutes" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "routing_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "routing_steps_orgId_itemId_sequence_idx" ON "routing_steps"("orgId", "itemId", "sequence");

DO $$ BEGIN
  ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TYPE "AsnStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "asn_shipments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseDocumentId" TEXT,
    "number" TEXT NOT NULL,
    "status" "AsnStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedAt" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asn_shipments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asn_shipments_orgId_number_key" ON "asn_shipments"("orgId", "number");
CREATE INDEX IF NOT EXISTS "asn_shipments_orgId_status_expectedAt_idx" ON "asn_shipments"("orgId", "status", "expectedAt");
CREATE INDEX IF NOT EXISTS "asn_shipments_vendorId_idx" ON "asn_shipments"("vendorId");
CREATE INDEX IF NOT EXISTS "asn_shipments_purchaseDocumentId_idx" ON "asn_shipments"("purchaseDocumentId");

CREATE TABLE IF NOT EXISTS "asn_shipment_lines" (
    "id" TEXT NOT NULL,
    "asnId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asn_shipment_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "asn_shipment_lines_asnId_idx" ON "asn_shipment_lines"("asnId");
CREATE INDEX IF NOT EXISTS "asn_shipment_lines_itemId_idx" ON "asn_shipment_lines"("itemId");

DO $$ BEGIN
  ALTER TABLE "asn_shipments" ADD CONSTRAINT "asn_shipments_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "asn_shipments" ADD CONSTRAINT "asn_shipments_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "asn_shipments" ADD CONSTRAINT "asn_shipments_purchaseDocumentId_fkey"
    FOREIGN KEY ("purchaseDocumentId") REFERENCES "purchase_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "asn_shipment_lines" ADD CONSTRAINT "asn_shipment_lines_asnId_fkey"
    FOREIGN KEY ("asnId") REFERENCES "asn_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "asn_shipment_lines" ADD CONSTRAINT "asn_shipment_lines_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
