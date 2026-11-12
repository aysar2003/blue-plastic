-- ---------------------------------------------------------------------------
-- Optional org-scoped RLS for erp_app (defense in depth).
--
-- Requires role `erp_app` (see app-role-least-privilege.sql). When
-- `app.current_org_id` is unset, behaviour matches today (full access for
-- erp_app). When set via SET LOCAL inside a transaction, rows are filtered.
--
-- PgBouncer transaction mode (:6543) does not keep session GUCs across
-- statements — use session pooler (:5432) or interactive transactions if you
-- rely on this. Application `orgId` filters remain the primary control.
--
-- Idempotent under `pnpm db:harden`. Skips when erp_app is absent.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  has_org boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    RAISE NOTICE 'erp_app role not present — skip org RLS policies.';
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r.name
        AND column_name = 'orgId'
    ) INTO has_org;

    EXECUTE format('DROP POLICY IF EXISTS erp_app_access ON public.%I', r.name);
    EXECUTE format('DROP POLICY IF EXISTS erp_app_org ON public.%I', r.name);

    IF has_org THEN
      EXECUTE format(
        $policy$
        CREATE POLICY erp_app_org ON public.%I FOR ALL TO erp_app
        USING (
          NULLIF(current_setting('app.current_org_id', true), '') IS NULL
          OR "orgId"::text = current_setting('app.current_org_id', true)
          OR current_setting('app.rls_bypass', true) = '1'
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_org_id', true), '') IS NULL
          OR "orgId"::text = current_setting('app.current_org_id', true)
          OR current_setting('app.rls_bypass', true) = '1'
        )
        $policy$,
        r.name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY erp_app_access ON public.%I FOR ALL TO erp_app USING (true) WITH CHECK (true)',
        r.name
      );
    END IF;
  END LOOP;
END $$;
