-- ---------------------------------------------------------------------------
-- API lockdown -- Prisma is the only writer/reader of business tables.
--
-- Supabase exposes schema `public` through PostgREST to `anon` / `authenticated`.
-- This ERP never uses that path: the Next.js server connects as `postgres`
-- (rolbypassrls = true). Enable RLS, attach a deny-all policy so the Data API
-- sees nothing (and the advisor is quiet), and revoke table/sequence privileges
-- from the client roles.
--
-- Idempotent -- safe to re-run via `pnpm db:harden`.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.name);
    EXECUTE format('DROP POLICY IF EXISTS erp_no_direct_access ON public.%I', r.name);
    -- Deny every role that does not bypass RLS. postgres / service_role ignore it.
    EXECUTE format(
      'CREATE POLICY erp_no_direct_access ON public.%I FOR ALL USING (false) WITH CHECK (false)',
      r.name
    );
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
