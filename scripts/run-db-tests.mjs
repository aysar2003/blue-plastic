/**
 * Run Vitest with ALLOW_DB_TESTS=1 so hosted Supabase (or any DATABASE_URL)
 * integration suites are not skipped by tests/setup.ts.
 *
 * Prefer a local Postgres URL. Hosted runs intentionally raise ERROR rows in
 * the Supabase dashboard — that is the suite proving the DB refuses bad writes.
 */
process.env.ALLOW_DB_TESTS = '1'

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
