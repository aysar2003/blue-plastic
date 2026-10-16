-- CreateEnum
CREATE TYPE "RecurringDocType" AS ENUM ('JOURNAL', 'BILL', 'EXPENSE');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecurringDocType" NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "nextRunOn" DATE NOT NULL,
    "endOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB NOT NULL,
    "lastRunOn" DATE,
    "lastDocumentId" TEXT,
    "lastDocumentKind" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_templates_orgId_isActive_nextRunOn_idx" ON "recurring_templates"("orgId", "isActive", "nextRunOn");

-- CreateIndex
CREATE INDEX "recurring_templates_orgId_updatedAt_idx" ON "recurring_templates"("orgId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
