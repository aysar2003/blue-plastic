-- Phase education: programs, terms, fee plans, student enrollments → AR

CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'WITHDRAWN', 'COMPLETED');

CREATE TABLE IF NOT EXISTS "academic_programs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_programs_orgId_name_key" ON "academic_programs"("orgId", "name");
CREATE INDEX IF NOT EXISTS "academic_programs_orgId_isActive_idx" ON "academic_programs"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "academic_terms" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_terms_orgId_name_key" ON "academic_terms"("orgId", "name");
CREATE INDEX IF NOT EXISTS "academic_terms_orgId_isActive_startsOn_idx" ON "academic_terms"("orgId", "isActive", "startsOn");

CREATE TABLE IF NOT EXISTS "fee_plans" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_plans_orgId_name_key" ON "fee_plans"("orgId", "name");
CREATE INDEX IF NOT EXISTS "fee_plans_orgId_isActive_idx" ON "fee_plans"("orgId", "isActive");
CREATE INDEX IF NOT EXISTS "fee_plans_programId_idx" ON "fee_plans"("programId");

CREATE TABLE IF NOT EXISTS "fee_plan_lines" (
    "id" TEXT NOT NULL,
    "feePlanId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(19,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_plan_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fee_plan_lines_feePlanId_sortOrder_idx" ON "fee_plan_lines"("feePlanId", "sortOrder");
CREATE INDEX IF NOT EXISTS "fee_plan_lines_itemId_idx" ON "fee_plan_lines"("itemId");

CREATE TABLE IF NOT EXISTS "student_enrollments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "feePlanId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "scholarshipPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "salesDocumentId" TEXT,
    "notes" TEXT,
    "enrolledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_salesDocumentId_key" ON "student_enrollments"("salesDocumentId");
CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_orgId_customerId_programId_termId_key"
  ON "student_enrollments"("orgId", "customerId", "programId", "termId");
CREATE INDEX IF NOT EXISTS "student_enrollments_orgId_status_enrolledAt_idx"
  ON "student_enrollments"("orgId", "status", "enrolledAt" DESC);
CREATE INDEX IF NOT EXISTS "student_enrollments_termId_status_idx" ON "student_enrollments"("termId", "status");
CREATE INDEX IF NOT EXISTS "student_enrollments_customerId_idx" ON "student_enrollments"("customerId");

DO $$ BEGIN
  ALTER TABLE "academic_programs" ADD CONSTRAINT "academic_programs_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "academic_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "fee_plan_lines" ADD CONSTRAINT "fee_plan_lines_feePlanId_fkey"
    FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "fee_plan_lines" ADD CONSTRAINT "fee_plan_lines_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "academic_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_feePlanId_fkey"
    FOREIGN KEY ("feePlanId") REFERENCES "fee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_salesDocumentId_fkey"
    FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
