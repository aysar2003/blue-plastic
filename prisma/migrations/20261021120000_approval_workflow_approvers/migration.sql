-- Assign users to approval workflows, tag ready-made vs custom rules,
-- and remember which rule gated each request.

ALTER TABLE "approval_policies"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN IF NOT EXISTS "packKey" TEXT;

ALTER TABLE "approval_requests"
  ADD COLUMN IF NOT EXISTS "policyId" TEXT;

CREATE TABLE IF NOT EXISTS "approval_policy_approvers" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "approval_policy_approvers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_policy_approvers_policyId_userId_key"
  ON "approval_policy_approvers"("policyId", "userId");
CREATE INDEX IF NOT EXISTS "approval_policy_approvers_orgId_idx"
  ON "approval_policy_approvers"("orgId");
CREATE INDEX IF NOT EXISTS "approval_policy_approvers_userId_idx"
  ON "approval_policy_approvers"("userId");

ALTER TABLE "approval_policy_approvers"
  DROP CONSTRAINT IF EXISTS "approval_policy_approvers_orgId_fkey";
ALTER TABLE "approval_policy_approvers"
  ADD CONSTRAINT "approval_policy_approvers_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_policy_approvers"
  DROP CONSTRAINT IF EXISTS "approval_policy_approvers_policyId_fkey";
ALTER TABLE "approval_policy_approvers"
  ADD CONSTRAINT "approval_policy_approvers_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_policy_approvers"
  DROP CONSTRAINT IF EXISTS "approval_policy_approvers_userId_fkey";
ALTER TABLE "approval_policy_approvers"
  ADD CONSTRAINT "approval_policy_approvers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "approval_requests_policyId_idx"
  ON "approval_requests"("policyId");

ALTER TABLE "approval_requests"
  DROP CONSTRAINT IF EXISTS "approval_requests_policyId_fkey";
ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_policy_approvers" ENABLE ROW LEVEL SECURITY;
