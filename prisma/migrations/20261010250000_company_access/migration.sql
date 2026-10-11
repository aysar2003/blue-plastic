-- Who may see every company, and which company a person lands in at sign-in.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSystemOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "homeOrgId" TEXT;

-- Connect is an admin-only grant. Staff stay in their own company.
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "canConnect" BOOLEAN NOT NULL DEFAULT false;

-- The earliest company's earliest owner is the system owner.
UPDATE "users" u
SET "isSystemOwner" = true
WHERE u.id = (
  SELECT m."userId"
  FROM "memberships" m
  JOIN "organizations" o ON o.id = m."orgId"
  WHERE m.role = 'OWNER' AND m.status = 'ACTIVE'
  ORDER BY o."createdAt" ASC, m."createdAt" ASC
  LIMIT 1
);

-- Home company is the first active membership, so sign-in does not wander.
UPDATE "users" u
SET "homeOrgId" = sub."orgId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "orgId"
  FROM "memberships"
  WHERE status = 'ACTIVE'
  ORDER BY "userId", "createdAt" ASC
) sub
WHERE u.id = sub."userId"
  AND u."homeOrgId" IS NULL;
