-- Sales delivery notes (packing / dispatch) and sale-linked store tickets.

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DELIVERY_NOTE';

CREATE TABLE IF NOT EXISTS "delivery_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "salesDocumentId" TEXT NOT NULL,
    "storeId" TEXT,
    "carrier" TEXT,
    "notes" TEXT,
    "status" "BankDocumentStatus" NOT NULL DEFAULT 'POSTED',
    "voidedAt" TIMESTAMPTZ(6),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_notes_orgId_number_key" ON "delivery_notes"("orgId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_notes_orgId_salesDocumentId_key" ON "delivery_notes"("orgId", "salesDocumentId");
CREATE INDEX IF NOT EXISTS "delivery_notes_orgId_date_idx" ON "delivery_notes"("orgId", "date" DESC);
CREATE INDEX IF NOT EXISTS "delivery_notes_orgId_customerId_date_idx" ON "delivery_notes"("orgId", "customerId", "date" DESC);
CREATE INDEX IF NOT EXISTS "delivery_notes_orgId_status_idx" ON "delivery_notes"("orgId", "status");

CREATE TABLE IF NOT EXISTS "delivery_note_lines" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "lineNumber" SMALLINT NOT NULL,
    "itemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "storeId" TEXT,
    "salesDocumentLineId" TEXT,

    CONSTRAINT "delivery_note_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "delivery_note_lines_deliveryNoteId_lineNumber_idx" ON "delivery_note_lines"("deliveryNoteId", "lineNumber");
CREATE INDEX IF NOT EXISTS "delivery_note_lines_orgId_deliveryNoteId_idx" ON "delivery_note_lines"("orgId", "deliveryNoteId");

ALTER TABLE "store_tickets" ADD COLUMN IF NOT EXISTS "salesDocumentId" TEXT;
ALTER TABLE "store_tickets" ADD COLUMN IF NOT EXISTS "salesDocumentLineId" TEXT;
ALTER TABLE "store_tickets" ADD COLUMN IF NOT EXISTS "deliveryNoteId" TEXT;

CREATE INDEX IF NOT EXISTS "store_tickets_orgId_salesDocumentId_idx" ON "store_tickets"("orgId", "salesDocumentId");
CREATE INDEX IF NOT EXISTS "store_tickets_orgId_deliveryNoteId_idx" ON "store_tickets"("orgId", "deliveryNoteId");

DO $$ BEGIN
  ALTER TABLE "delivery_notes"
    ADD CONSTRAINT "delivery_notes_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_notes"
    ADD CONSTRAINT "delivery_notes_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_notes"
    ADD CONSTRAINT "delivery_notes_salesDocumentId_fkey"
    FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_notes"
    ADD CONSTRAINT "delivery_notes_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_note_lines"
    ADD CONSTRAINT "delivery_note_lines_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_note_lines"
    ADD CONSTRAINT "delivery_note_lines_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_salesDocumentId_fkey"
    FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
