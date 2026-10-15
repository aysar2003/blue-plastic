try {
  process.loadEnvFile('.env')
} catch {
  // Environment already populated (CI).
}

// Integration tests need a database; unit tests do not. Both need the module-level
// validation in `lib/env.ts` to pass.
process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters-long'

/**
 * Integrity suites deliberately raise Postgres ERRORs (trigger / check refusals).
 * That is correct on a disposable local database. Against hosted Supabase it
 * floods the project dashboard, burns free-tier quota, and looks like an outage.
 *
 * Hosted URLs are therefore ignored unless ALLOW_DB_TESTS=1.
 * Use: `$env:ALLOW_DB_TESTS=1; pnpm test` (PowerShell) or `pnpm test:db`.
 */
const databaseUrl = process.env.DATABASE_URL ?? ''
const allowHostedDbTests =
  process.env.ALLOW_DB_TESTS === '1' || process.env.ALLOW_DB_TESTS === 'true'
// Pooler hosts use supabase.com; direct hosts use supabase.co.
const isHostedSupabase = /supabase\.(co|com)\b/i.test(databaseUrl)

if (databaseUrl && isHostedSupabase && !allowHostedDbTests) {
  delete process.env.DATABASE_URL
  delete process.env.DIRECT_URL
  console.warn(
    '[vitest] Skipping DB integration tests: DATABASE_URL points at hosted Supabase. Set ALLOW_DB_TESTS=1 to run them (prefer a local DB).',
  )
}
