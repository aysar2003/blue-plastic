/**
 * Prefer the vitest path (stubs server-only):
 *   $env:ALLOW_DB_TESTS='1'; pnpm exec vitest run tests/export-month-quotations-pdf.test.ts
 *
 * This file is kept as a thin wrapper that sets ALLOW_DB_TESTS and runs that test,
 * then opens the PDF from Downloads.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

process.env.ALLOW_DB_TESTS = '1'

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'tests/export-month-quotations-pdf.test.ts'],
  { stdio: 'inherit', shell: true, env: process.env },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const downloads = join(homedir(), 'Downloads')
const match = readdirSync(downloads)
  .filter((name) => name.startsWith('AFG-quotations-October-2026-') && name.endsWith('.pdf'))
  .sort()
  .at(-1)

if (!match) {
  console.error('PDF was not written to Downloads.')
  process.exit(1)
}

const out = join(downloads, match)
if (!existsSync(out)) {
  console.error(`Missing ${out}`)
  process.exit(1)
}

spawnSync('cmd', ['/c', 'start', '', out], { stdio: 'ignore' })
console.log(`Opened ${out}`)
