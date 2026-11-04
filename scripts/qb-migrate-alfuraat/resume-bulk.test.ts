import { describe, it } from 'vitest'

describe('qb-migrate-resume', () => {
  it(
    'resume remaining invoices bills journals payments',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./resume-bulk.ts')
      await main()
    },
    24 * 60 * 60 * 1000,
  )
})
