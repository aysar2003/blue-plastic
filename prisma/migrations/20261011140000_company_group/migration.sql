-- Main / sub company group: a holding (main) company may own child databases.
-- One level only. Max children is enforced in application code (2).
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "parentOrgId" TEXT;

CREATE INDEX IF NOT EXISTS "organizations_parentOrgId_idx" ON "organizations"("parentOrgId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_parentOrgId_fkey'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_parentOrgId_fkey"
      FOREIGN KEY ("parentOrgId") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
