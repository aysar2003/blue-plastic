-- Customer portal: CUSTOMER role + User↔Customer link.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTOMER';

CREATE TABLE "customer_portal_users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_portal_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_portal_users_orgId_userId_key" ON "customer_portal_users"("orgId", "userId");

CREATE INDEX "customer_portal_users_orgId_customerId_idx" ON "customer_portal_users"("orgId", "customerId");

ALTER TABLE "customer_portal_users" ADD CONSTRAINT "customer_portal_users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_portal_users" ADD CONSTRAINT "customer_portal_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_portal_users" ADD CONSTRAINT "customer_portal_users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
