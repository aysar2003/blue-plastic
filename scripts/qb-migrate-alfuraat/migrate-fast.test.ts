import { describe, it } from 'vitest'

describe('qb-migrate-alfuraat-fast', () => {
  it(
    'bulk lists + concurrent invoices/bills/journals/payments',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./migrate-fast.ts')
      await main()
    },
    3 * 60 * 60 * 1000,
  )
})
