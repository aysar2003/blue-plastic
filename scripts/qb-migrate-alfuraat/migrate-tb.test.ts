import { describe, it } from 'vitest'

describe('qb-migrate-tb', () => {
  it(
    'post QuickBooks trial balance so the Balance Sheet matches',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./migrate-tb.ts')
      await main()
    },
    2 * 60 * 60 * 1000,
  )
})
