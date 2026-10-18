-- ---------------------------------------------------------------------------
-- API lockdown -- Prisma is the only writer/reader of business tables.
--
-- Supabase exposes schema `public` through PostgREST to `anon` / `authenticated`.
-- This ERP never uses that path: the Next.js server connects as `postgres`
-- (rolbypassrls = true). Enable RLS with no policies so the Data API sees
-- nothing, and revoke table/sequence privileges from the client roles.
--
-- Idempotent -- also re-applied by `pnpm db:harden` via prisma/sql/api-lockdown.sql.
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

-- Pin search_path on integrity trigger functions (source of truth: prisma/sql/*).
ALTER FUNCTION public.assert_account_classification() SET search_path TO public;
ALTER FUNCTION public.assert_application_source() SET search_path TO public;
ALTER FUNCTION public.assert_application_target() SET search_path TO public;
ALTER FUNCTION public.assert_deposit_total() SET search_path TO public;
ALTER FUNCTION public.assert_document_totals() SET search_path TO public;
ALTER FUNCTION public.assert_entry_account_matches() SET search_path TO public;
ALTER FUNCTION public.assert_item_account_mapping() SET search_path TO public;
ALTER FUNCTION public.assert_journal_balanced() SET search_path TO public;
ALTER FUNCTION public.assert_line_dimensions() SET search_path TO public;
ALTER FUNCTION public.assert_locked_year_has_no_open_period() SET search_path TO public;
ALTER FUNCTION public.assert_movement_continuity() SET search_path TO public;
ALTER FUNCTION public.assert_movement_item_tracked() SET search_path TO public;
ALTER FUNCTION public.assert_period_accepts_posting() SET search_path TO public;
ALTER FUNCTION public.assert_purchase_application_source() SET search_path TO public;
ALTER FUNCTION public.assert_purchase_application_target() SET search_path TO public;
ALTER FUNCTION public.assert_purchase_totals() SET search_path TO public;
ALTER FUNCTION public.forbid_completed_entry_change() SET search_path TO public;
ALTER FUNCTION public.forbid_completed_reconciliation_change() SET search_path TO public;
ALTER FUNCTION public.forbid_inventory_movement_change() SET search_path TO public;
ALTER FUNCTION public.forbid_posted_journal_mutation() SET search_path TO public;
ALTER FUNCTION public.forbid_posted_line_mutation() SET search_path TO public;
ALTER FUNCTION public.protect_system_accounts() SET search_path TO public;
