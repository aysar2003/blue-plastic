-- Phase 18: complete lite collab/HR/CRM/planning/sign/surveys for SME ERP depth.

ALTER TYPE "ApplicantStatus" ADD VALUE IF NOT EXISTS 'SCREENING';
ALTER TYPE "SignRequestStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

DO $$ BEGIN
  CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "SurveyStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CrmOpportunityStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CrmActivityKind" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "appraisals"
  ADD COLUMN IF NOT EXISTS "goals" TEXT,
  ADD COLUMN IF NOT EXISTS "competencies" JSONB;

ALTER TABLE "discuss_messages"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT,
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMPTZ(6);

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
  ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT;

ALTER TABLE "sign_requests"
  ADD COLUMN IF NOT EXISTS "token" TEXT,
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "declineReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "sign_requests_token_key" ON "sign_requests"("token");

ALTER TABLE "surveys"
  ADD COLUMN IF NOT EXISTS "status" "SurveyStatus" NOT NULL DEFAULT 'OPEN';

CREATE INDEX IF NOT EXISTS "discuss_messages_orgId_parentId_idx" ON "discuss_messages"("orgId", "parentId");
CREATE INDEX IF NOT EXISTS "appointments_orgId_status_idx" ON "appointments"("orgId", "status");
CREATE INDEX IF NOT EXISTS "surveys_orgId_status_idx" ON "surveys"("orgId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discuss_messages_parentId_fkey'
  ) THEN
    ALTER TABLE "discuss_messages"
      ADD CONSTRAINT "discuss_messages_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "discuss_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "planning_assignments" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "taskId" TEXT,
  "workDate" DATE NOT NULL,
  "hours" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "planning_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "planning_assignments_orgId_workDate_idx" ON "planning_assignments"("orgId", "workDate");
CREATE INDEX IF NOT EXISTS "planning_assignments_orgId_employeeId_workDate_idx" ON "planning_assignments"("orgId", "employeeId", "workDate");

CREATE TABLE IF NOT EXISTS "crm_opportunities" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(19,4),
  "stage" "CrmOpportunityStage" NOT NULL DEFAULT 'LEAD',
  "expectedClose" DATE,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_opportunities_orgId_stage_updatedAt_idx" ON "crm_opportunities"("orgId", "stage", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "crm_opportunities_orgId_customerId_idx" ON "crm_opportunities"("orgId", "customerId");

CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "opportunityId" TEXT,
  "createdById" TEXT,
  "kind" "CrmActivityKind" NOT NULL DEFAULT 'NOTE',
  "subject" TEXT NOT NULL,
  "dueAt" TIMESTAMPTZ(6),
  "doneAt" TIMESTAMPTZ(6),
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_activities_orgId_customerId_dueAt_idx" ON "crm_activities"("orgId", "customerId", "dueAt");
CREATE INDEX IF NOT EXISTS "crm_activities_orgId_doneAt_idx" ON "crm_activities"("orgId", "doneAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planning_assignments_orgId_fkey') THEN
    ALTER TABLE "planning_assignments"
      ADD CONSTRAINT "planning_assignments_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planning_assignments_employeeId_fkey') THEN
    ALTER TABLE "planning_assignments"
      ADD CONSTRAINT "planning_assignments_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_orgId_fkey') THEN
    ALTER TABLE "crm_opportunities"
      ADD CONSTRAINT "crm_opportunities_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_customerId_fkey') THEN
    ALTER TABLE "crm_opportunities"
      ADD CONSTRAINT "crm_opportunities_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_orgId_fkey') THEN
    ALTER TABLE "crm_activities"
      ADD CONSTRAINT "crm_activities_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_customerId_fkey') THEN
    ALTER TABLE "crm_activities"
      ADD CONSTRAINT "crm_activities_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_opportunityId_fkey') THEN
    ALTER TABLE "crm_activities"
      ADD CONSTRAINT "crm_activities_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_createdById_fkey') THEN
    ALTER TABLE "crm_activities"
      ADD CONSTRAINT "crm_activities_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
