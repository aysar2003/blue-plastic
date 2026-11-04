import { describe, it } from 'vitest'

describe('qb-migrate-resume-correct', () => {
  it(
    'resume remaining bills journals payments after timeout',
    async () => {
      process.env.ALLOW_DB_TESTS = '1'
      const { main } = await import('./resume-correct.ts')
      await main()
    },
    3 * 60 * 60 * 1000,
  )
})
