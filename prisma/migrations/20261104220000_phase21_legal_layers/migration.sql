-- Phase 21: legal SME layers — hedge docs, kitchen tickets, bins/picks, training.

DO $$ BEGIN
  CREATE TYPE "FxHedgeKind" AS ENUM ('CASH_FLOW', 'FAIR_VALUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "FxHedgeStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "KitchenTicketStatus" AS ENUM ('OPEN', 'FIRED', 'READY', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "PickTaskStatus" AS ENUM ('OPEN', 'PICKING', 'PICKED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('ENROLLED', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "fx_hedges" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "kind" "FxHedgeKind" NOT NULL DEFAULT 'CASH_FLOW',
  "status" "FxHedgeStatus" NOT NULL DEFAULT 'OPEN',
  "currencyCode" TEXT NOT NULL,
  "contractRate" DECIMAL(19,9) NOT NULL,
  "notional" DECIMAL(19,4) NOT NULL,
  "maturityDate" DATE NOT NULL,
  "risk" TEXT NOT NULL,
  "hedgedItem" TEXT NOT NULL,
  "instrument" TEXT NOT NULL,
  "counterpart" TEXT,
  "memo" TEXT,
  "journalId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "fx_hedges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fx_hedges_orgId_status_maturityDate_idx" ON "fx_hedges"("orgId", "status", "maturityDate");
DO $$ BEGIN
  ALTER TABLE "fx_hedges" ADD CONSTRAINT "fx_hedges_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "kitchen_tickets" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "tableLabel" TEXT,
  "covers" SMALLINT NOT NULL DEFAULT 1,
  "status" "KitchenTicketStatus" NOT NULL DEFAULT 'OPEN',
  "lines" JSONB NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "kitchen_tickets_orgId_status_createdAt_idx" ON "kitchen_tickets"("orgId", "status", "createdAt" DESC);
DO $$ BEGIN
  ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "stock_bins" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_bins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_bins_storeId_code_key" ON "stock_bins"("storeId", "code");
CREATE INDEX IF NOT EXISTS "stock_bins_orgId_storeId_idx" ON "stock_bins"("orgId", "storeId");
DO $$ BEGIN
  ALTER TABLE "stock_bins" ADD CONSTRAINT "stock_bins_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "stock_bins" ADD CONSTRAINT "stock_bins_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "pick_tasks" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "binId" TEXT,
  "itemId" TEXT NOT NULL,
  "qty" DECIMAL(19,4) NOT NULL,
  "status" "PickTaskStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pick_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pick_tasks_orgId_status_createdAt_idx" ON "pick_tasks"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "pick_tasks_orgId_storeId_idx" ON "pick_tasks"("orgId", "storeId");
DO $$ BEGIN
  ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_binId_fkey"
    FOREIGN KEY ("binId") REFERENCES "stock_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "training_courses" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "hours" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "training_courses_orgId_active_idx" ON "training_courses"("orgId", "active");
DO $$ BEGIN
  ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "training_enrollments" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
  "completedAt" TIMESTAMPTZ(6),
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "training_enrollments_courseId_employeeId_key" ON "training_enrollments"("courseId", "employeeId");
CREATE INDEX IF NOT EXISTS "training_enrollments_orgId_status_idx" ON "training_enrollments"("orgId", "status");
DO $$ BEGIN
  ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
