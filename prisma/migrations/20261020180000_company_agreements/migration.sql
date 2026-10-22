-- Per-company agreement papers (system owner desk).

CREATE TYPE "CompanyAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

CREATE TABLE "company_agreements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CompanyAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "startsOn" DATE,
    "endsOn" DATE,
    "notes" TEXT,
    "originalName" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_agreements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_agreements_orgId_status_idx" ON "company_agreements"("orgId", "status");

ALTER TABLE "company_agreements"
  ADD CONSTRAINT "company_agreements_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_agreements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_no_direct_access ON public.company_agreements;
CREATE POLICY erp_no_direct_access ON public.company_agreements
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.company_agreements FROM anon, authenticated;

CREATE TABLE "marketing_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_leads_createdAt_idx" ON "marketing_leads"("createdAt");

ALTER TABLE "marketing_leads" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_no_direct_access ON public.marketing_leads;
CREATE POLICY erp_no_direct_access ON public.marketing_leads
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.marketing_leads FROM anon, authenticated;
