-- Phase hospital billing admin: visits + charges → AR (not EMR)

CREATE TYPE "PatientVisitStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "patient_visits" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "PatientVisitStatus" NOT NULL DEFAULT 'OPEN',
    "trackingCategoryId" TEXT,
    "payerName" TEXT,
    "payerRef" TEXT,
    "notes" TEXT,
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(6),
    "salesDocumentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_visits_salesDocumentId_key" ON "patient_visits"("salesDocumentId");
CREATE INDEX IF NOT EXISTS "patient_visits_orgId_status_openedAt_idx" ON "patient_visits"("orgId", "status", "openedAt" DESC);
CREATE INDEX IF NOT EXISTS "patient_visits_customerId_idx" ON "patient_visits"("customerId");
CREATE INDEX IF NOT EXISTS "patient_visits_trackingCategoryId_idx" ON "patient_visits"("trackingCategoryId");

CREATE TABLE IF NOT EXISTS "visit_charges" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "billCode" TEXT,
    "postedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visit_charges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visit_charges_visitId_idx" ON "visit_charges"("visitId");
CREATE INDEX IF NOT EXISTS "visit_charges_itemId_idx" ON "visit_charges"("itemId");

DO $$ BEGIN
  ALTER TABLE "patient_visits" ADD CONSTRAINT "patient_visits_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "patient_visits" ADD CONSTRAINT "patient_visits_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "patient_visits" ADD CONSTRAINT "patient_visits_trackingCategoryId_fkey"
    FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "patient_visits" ADD CONSTRAINT "patient_visits_salesDocumentId_fkey"
    FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "visit_charges" ADD CONSTRAINT "visit_charges_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "patient_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "visit_charges" ADD CONSTRAINT "visit_charges_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
