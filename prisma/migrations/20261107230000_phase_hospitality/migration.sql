-- Phase hospitality: restaurant tables/tips/night audit + hotel rooms/folio

DO $$ BEGIN
  ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'TIP_LIABILITY';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'POS_TIP';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DiningTableStatus" AS ENUM ('OPEN', 'SEATED', 'BILL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NightAuditStatus" AS ENUM ('DRAFT', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "RoomStatus" AS ENUM ('VACANT', 'OCCUPIED', 'DIRTY', 'CLEAN', 'OOO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StayStatus" AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "tipAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "tipJournalId" TEXT;
ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "diningTableId" TEXT;

ALTER TABLE "kitchen_tickets" ADD COLUMN IF NOT EXISTS "diningTableId" TEXT;
ALTER TABLE "kitchen_tickets" ADD COLUMN IF NOT EXISTS "posOrderId" TEXT;

CREATE TABLE IF NOT EXISTS "dining_tables" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" SMALLINT NOT NULL DEFAULT 4,
    "zone" TEXT,
    "status" "DiningTableStatus" NOT NULL DEFAULT 'OPEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dining_tables_orgId_code_key" ON "dining_tables"("orgId", "code");
CREATE INDEX IF NOT EXISTS "dining_tables_orgId_status_isActive_idx" ON "dining_tables"("orgId", "status", "isActive");

CREATE TABLE IF NOT EXISTS "night_audit_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" "NightAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" JSONB NOT NULL,
    "closedAt" TIMESTAMPTZ(6),
    "closedById" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "night_audit_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "night_audit_runs_orgId_businessDate_key" ON "night_audit_runs"("orgId", "businessDate");
CREATE INDEX IF NOT EXISTS "night_audit_runs_orgId_status_businessDate_idx" ON "night_audit_runs"("orgId", "status", "businessDate" DESC);

CREATE TABLE IF NOT EXISTS "room_types" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRateItemId" TEXT,
    "capacity" SMALLINT NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "room_types_orgId_name_key" ON "room_types"("orgId", "name");
CREATE INDEX IF NOT EXISTS "room_types_orgId_isActive_idx" ON "room_types"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "rooms" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" TEXT,
    "status" "RoomStatus" NOT NULL DEFAULT 'VACANT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rooms_orgId_code_key" ON "rooms"("orgId", "code");
CREATE INDEX IF NOT EXISTS "rooms_orgId_status_isActive_idx" ON "rooms"("orgId", "status", "isActive");
CREATE INDEX IF NOT EXISTS "rooms_roomTypeId_idx" ON "rooms"("roomTypeId");

CREATE TABLE IF NOT EXISTS "stays" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "StayStatus" NOT NULL DEFAULT 'RESERVED',
    "checkInAt" TIMESTAMPTZ(6) NOT NULL,
    "checkOutAt" TIMESTAMPTZ(6),
    "adults" SMALLINT NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stays_orgId_status_checkInAt_idx" ON "stays"("orgId", "status", "checkInAt" DESC);
CREATE INDEX IF NOT EXISTS "stays_roomId_status_idx" ON "stays"("roomId", "status");
CREATE INDEX IF NOT EXISTS "stays_customerId_idx" ON "stays"("customerId");

CREATE TABLE IF NOT EXISTS "folios" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "salesDocumentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "folios_stayId_key" ON "folios"("stayId");
CREATE UNIQUE INDEX IF NOT EXISTS "folios_salesDocumentId_key" ON "folios"("salesDocumentId");
CREATE INDEX IF NOT EXISTS "folios_orgId_status_idx" ON "folios"("orgId", "status");

CREATE TABLE IF NOT EXISTS "folio_lines" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folio_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "folio_lines_folioId_idx" ON "folio_lines"("folioId");

-- FKs (idempotent-ish via exception swallow)
DO $$ BEGIN
  ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "night_audit_runs" ADD CONSTRAINT "night_audit_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "room_types" ADD CONSTRAINT "room_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "room_types" ADD CONSTRAINT "room_types_baseRateItemId_fkey" FOREIGN KEY ("baseRateItemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "rooms" ADD CONSTRAINT "rooms_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "rooms" ADD CONSTRAINT "rooms_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "stays" ADD CONSTRAINT "stays_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "stays" ADD CONSTRAINT "stays_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "stays" ADD CONSTRAINT "stays_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "folios" ADD CONSTRAINT "folios_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "folios" ADD CONSTRAINT "folios_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "stays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "folios" ADD CONSTRAINT "folios_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "folio_lines" ADD CONSTRAINT "folio_lines_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "folio_lines" ADD CONSTRAINT "folio_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tipJournalId_fkey" FOREIGN KEY ("tipJournalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "dining_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "dining_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_posOrderId_fkey" FOREIGN KEY ("posOrderId") REFERENCES "pos_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "pos_orders_tipJournalId_key" ON "pos_orders"("tipJournalId");
CREATE INDEX IF NOT EXISTS "pos_orders_diningTableId_idx" ON "pos_orders"("diningTableId");
CREATE INDEX IF NOT EXISTS "kitchen_tickets_diningTableId_idx" ON "kitchen_tickets"("diningTableId");
CREATE INDEX IF NOT EXISTS "kitchen_tickets_posOrderId_idx" ON "kitchen_tickets"("posOrderId");
