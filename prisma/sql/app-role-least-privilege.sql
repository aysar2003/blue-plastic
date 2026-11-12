-- ---------------------------------------------------------------------------
-- Optional least-privilege app role (defense in depth).
--
-- Default deploy still uses the Supabase `postgres` (bypassrls) URL for Prisma.
-- To shrink blast radius if DATABASE_URL leaks:
--
-- 1. As postgres/superuser, once:
--      CREATE ROLE erp_app LOGIN PASSWORD 'replace-me' NOSUPERUSER NOCREATEDB
--        NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION;
-- 2. Re-run `pnpm db:harden` so this file grants table access.
-- 3. Point runtime DATABASE_URL at erp_app (pooler :6543). Keep DIRECT_URL as
--    postgres for migrations only.
--
-- Tenant isolation remains application-layer (orgId + requireOrgContext).
-- erp_app cannot create roles, drop the database, or bypass RLS; PostgREST
-- anon/authenticated stay denied by erp_no_direct_access.
--
-- Idempotent — safe under `pnpm db:harden`. Skips quietly when erp_app is absent.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    RAISE NOTICE 'erp_app role not present — skip least-privilege grants (optional).';
    RETURN;
  END IF;

  -- Prefer a locked-down role. Hosted Postgres (e.g. Supabase) may forbid ALTER ROLE;
  -- CREATE ROLE already set these flags when the setup script created erp_app.
  BEGIN
    EXECUTE 'ALTER ROLE erp_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER ROLE erp_app (insufficient privilege on this host).';
  END;

  GRANT USAGE ON SCHEMA public TO erp_app;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO erp_app', current_database());
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO erp_app;

  FOR r IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_app_access ON public.%I', r.name);
    EXECUTE format(
      'CREATE POLICY erp_app_access ON public.%I FOR ALL TO erp_app USING (true) WITH CHECK (true)',
      r.name
    );
  END LOOP;
END $$;
