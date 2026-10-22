-- ---------------------------------------------------------------------------
-- Clear advisor lint 0008 (RLS enabled, no policy) on every public table.
--
-- Access model unchanged: PostgREST roles stay locked out; Prisma connects as
-- postgres (bypassrls) and is unaffected. Idempotent with prisma/sql/api-lockdown.sql.
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
