-- School long-term durability: AcademicYear spine. Year-close never deletes education rows.

CREATE TYPE "AcademicYearStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE IF NOT EXISTS "academic_years" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_orgId_label_key" ON "academic_years"("orgId", "label");
CREATE INDEX IF NOT EXISTS "academic_years_orgId_status_startsOn_idx" ON "academic_years"("orgId", "status", "startsOn");

ALTER TABLE "academic_years"
  ADD CONSTRAINT "academic_years_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link existing terms to a backfilled OPEN year per org (keep all rows).
ALTER TABLE "academic_terms" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;

INSERT INTO "academic_years" ("id", "orgId", "label", "startsOn", "endsOn", "status", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t."orgId")::text,
  t."orgId",
  COALESCE(to_char(MIN(t."startsOn"), 'YYYY'), 'Legacy'),
  MIN(t."startsOn"),
  MAX(t."endsOn"),
  'OPEN',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "academic_terms" t
WHERE t."academicYearId" IS NULL
GROUP BY t."orgId"
ON CONFLICT ("orgId", "label") DO NOTHING;

UPDATE "academic_terms" term
SET "academicYearId" = y."id"
FROM "academic_years" y
WHERE term."orgId" = y."orgId"
  AND term."academicYearId" IS NULL
  AND y."status" = 'OPEN';

-- Orgs with no terms yet need no year; terms created after this migration require a year.
-- Force NOT NULL only when every term row has a year id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "academic_terms" WHERE "academicYearId" IS NULL) THEN
    RAISE EXCEPTION 'academic_terms.academicYearId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "academic_terms" ALTER COLUMN "academicYearId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "academic_terms_orgId_academicYearId_idx" ON "academic_terms"("orgId", "academicYearId");
CREATE INDEX IF NOT EXISTS "academic_terms_academicYearId_idx" ON "academic_terms"("academicYearId");

ALTER TABLE "academic_terms"
  ADD CONSTRAINT "academic_terms_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
