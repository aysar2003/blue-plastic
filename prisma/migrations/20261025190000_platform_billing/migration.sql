-- Platform rent plans, pay-to settings, and company rent payment proofs.

CREATE TYPE "CompanyRentPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "RentPaymentMethod" AS ENUM ('EVC', 'ZAAD', 'EDAHAB', 'BANK');

CREATE TABLE "platform_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "maxUsers" INTEGER,
    "modules" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_plans_active_sortOrder_idx" ON "platform_plans"("active", "sortOrder");

ALTER TABLE "platform_plans" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_no_direct_access ON public.platform_plans;
CREATE POLICY erp_no_direct_access ON public.platform_plans
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.platform_plans FROM anon, authenticated;

CREATE TABLE "platform_billing_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "evcNumber" TEXT,
    "zaadNumber" TEXT,
    "edahabNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "instructions" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_billing_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "platform_billing_settings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_no_direct_access ON public.platform_billing_settings;
CREATE POLICY erp_no_direct_access ON public.platform_billing_settings
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.platform_billing_settings FROM anon, authenticated;

CREATE TABLE "company_rent_payments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "CompanyRentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "RentPaymentMethod" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "notes" TEXT,
    "originalName" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "planName" TEXT NOT NULL,
    "planMonths" INTEGER NOT NULL,
    "planMaxUsers" INTEGER,
    "planModules" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_rent_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_rent_payments_status_createdAt_idx" ON "company_rent_payments"("status", "createdAt" DESC);
CREATE INDEX "company_rent_payments_orgId_createdAt_idx" ON "company_rent_payments"("orgId", "createdAt" DESC);

ALTER TABLE "company_rent_payments"
  ADD CONSTRAINT "company_rent_payments_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_rent_payments"
  ADD CONSTRAINT "company_rent_payments_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "platform_plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_rent_payments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_no_direct_access ON public.company_rent_payments;
CREATE POLICY erp_no_direct_access ON public.company_rent_payments
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.company_rent_payments FROM anon, authenticated;

-- Default plans (idempotent seed for fresh and existing DBs).
INSERT INTO "platform_plans" ("id", "name", "months", "price", "currency", "maxUsers", "modules", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('plan_starter', 'Starter', 1, 30.0000, 'USD', 3, NULL, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_growth', 'Growth', 3, 75.0000, 'USD', 8, NULL, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_year', 'Year', 12, 250.0000, 'USD', 20, NULL, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "platform_billing_settings" ("id", "instructions", "updatedAt")
VALUES (
  'default',
  'Pay the plan amount via EVC, Zaad, eDahab, or bank transfer, then submit your transaction reference below. The system owner will confirm and extend your rent.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
