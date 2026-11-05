-- Phase 28: work orders · Phase 29: pick stock fields · Phase 30: SME dashboards

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'WORK_ORDER';

DO $$ BEGIN
  CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'DONE', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DashboardTileKind" AS ENUM ('KPI', 'REPORT', 'SPARK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "assembly_builds" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

CREATE TABLE IF NOT EXISTS "work_orders" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "memo" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "work_order_lines" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "lineNumber" SMALLINT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "work_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_orders_orgId_number_key" ON "work_orders"("orgId", "number");
CREATE INDEX IF NOT EXISTS "work_orders_orgId_status_date_idx" ON "work_orders"("orgId", "status", "date" DESC);
CREATE INDEX IF NOT EXISTS "work_orders_orgId_itemId_idx" ON "work_orders"("orgId", "itemId");

CREATE UNIQUE INDEX IF NOT EXISTS "work_order_lines_workOrderId_lineNumber_key" ON "work_order_lines"("workOrderId", "lineNumber");
CREATE INDEX IF NOT EXISTS "work_order_lines_orgId_itemId_idx" ON "work_order_lines"("orgId", "itemId");

CREATE UNIQUE INDEX IF NOT EXISTS "assembly_builds_workOrderId_key" ON "assembly_builds"("workOrderId");

DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "assembly_builds" ADD CONSTRAINT "assembly_builds_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "pick_tasks" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "pick_tasks" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "pick_tasks" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;
ALTER TABLE "pick_tasks" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
CREATE INDEX IF NOT EXISTS "pick_tasks_orgId_sourceType_sourceId_idx" ON "pick_tasks"("orgId", "sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS "dashboards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dashboard_tiles" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "DashboardTileKind" NOT NULL,
    "refKey" TEXT NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "threshold" DECIMAL(19,4),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_tiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dashboards_orgId_isActive_name_idx" ON "dashboards"("orgId", "isActive", "name");
CREATE INDEX IF NOT EXISTS "dashboard_tiles_orgId_dashboardId_sortOrder_idx" ON "dashboard_tiles"("orgId", "dashboardId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "dashboard_tiles" ADD CONSTRAINT "dashboard_tiles_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
