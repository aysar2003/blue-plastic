import { describe, it } from 'vitest'

describe('qb-migrate-bulk', () => {
  it(
    'bulk import QB Desktop into AL FURAAT MATERIALS',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./migrate-bulk.ts')
      await main()
    },
    3 * 60 * 60 * 1000,
  )
})
