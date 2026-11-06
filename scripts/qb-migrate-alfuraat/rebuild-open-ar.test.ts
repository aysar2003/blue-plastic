import { describe, it } from 'vitest'

describe('qb-rebuild-open-ar', () => {
  it(
    'replaces TB customer AR with QuickBooks open invoices and unapplied payments',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./rebuild-open-ar.ts')
      await main()
    },
    60 * 60 * 1000,
  )
})
