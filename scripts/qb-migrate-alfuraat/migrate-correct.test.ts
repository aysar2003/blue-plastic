import { describe, it } from 'vitest'

describe('qb-migrate-correct', () => {
  it(
    'wipe and reimport AL FURAAT so the ledger matches QuickBooks accounts',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./migrate-correct.ts')
      await main()
    },
    3 * 60 * 60 * 1000,
  )
})
