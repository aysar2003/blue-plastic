-- Build assemblies: finished goods from a bill of materials.

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ASSEMBLY_BUILD';
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'ASSEMBLY_BUILD';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'BUILD';

-- Assemblies carry stock the same way inventory parts do.
CREATE OR REPLACE FUNCTION assert_movement_item_tracked() RETURNS trigger AS $$
DECLARE
  v_type text;
  v_name text;
BEGIN
  SELECT type::text, name INTO v_type, v_name FROM items WHERE id = NEW."itemId";

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Stock movement references an item that does not exist.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_type <> 'INVENTORY' AND v_type <> 'INVENTORY_ASSEMBLY' THEN
    RAISE EXCEPTION
      '"%" is not a tracked inventory item, so it has no stock to move.', v_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE "assembly_builds" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitCost" DECIMAL(19,6) NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "memo" TEXT,
    "status" "BankDocumentStatus" NOT NULL DEFAULT 'POSTED',
    "journalId" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assembly_builds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assembly_build_lines" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "lineNumber" SMALLINT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitCost" DECIMAL(19,6) NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "assembly_build_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assembly_builds_orgId_number_key" ON "assembly_builds"("orgId", "number");
CREATE UNIQUE INDEX "assembly_builds_id_orgId_key" ON "assembly_builds"("id", "orgId");
CREATE INDEX "assembly_builds_orgId_date_idx" ON "assembly_builds"("orgId", "date" DESC);
CREATE INDEX "assembly_builds_orgId_deletedAt_idx" ON "assembly_builds"("orgId", "deletedAt");
CREATE INDEX "assembly_builds_orgId_itemId_idx" ON "assembly_builds"("orgId", "itemId");

CREATE UNIQUE INDEX "assembly_build_lines_buildId_lineNumber_key" ON "assembly_build_lines"("buildId", "lineNumber");
CREATE INDEX "assembly_build_lines_orgId_itemId_idx" ON "assembly_build_lines"("orgId", "itemId");

ALTER TABLE "assembly_builds" ADD CONSTRAINT "assembly_builds_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assembly_builds" ADD CONSTRAINT "assembly_builds_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assembly_builds" ADD CONSTRAINT "assembly_builds_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assembly_builds" ADD CONSTRAINT "assembly_builds_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assembly_build_lines" ADD CONSTRAINT "assembly_build_lines_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "assembly_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assembly_build_lines" ADD CONSTRAINT "assembly_build_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
