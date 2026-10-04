-- Customer registration: agreement date, balance time, photo and debt papers.

ALTER TABLE "customers" ADD COLUMN "agreementDate" DATE,
ADD COLUMN "balanceTime" TEXT;

CREATE TYPE "CustomerFileKind" AS ENUM ('PHOTO', 'AGREEMENT');

CREATE TABLE "customer_files" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "CustomerFileKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_files_orgId_customerId_kind_idx" ON "customer_files"("orgId", "customerId", "kind");

ALTER TABLE "customer_files" ADD CONSTRAINT "customer_files_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_files" ADD CONSTRAINT "customer_files_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
