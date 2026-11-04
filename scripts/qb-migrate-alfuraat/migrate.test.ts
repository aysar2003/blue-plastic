/**
 * Vitest runner (has server-only stub). Long timeout for full QB import.
 * pnpm exec vitest run scripts/qb-migrate-alfuraat/migrate.test.ts
 */
import { describe, it } from 'vitest'

describe('qb-migrate-alfuraat', () => {
  it(
    'wipes AL FURAAT MATERIALS and imports QuickBooks Desktop export',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./migrate.ts')
      await main()
    },
    60 * 60 * 1000,
  )
})
