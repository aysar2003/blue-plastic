import { describe, expect, it } from 'vitest'

describe('env', () => {
  it('has db', () => {
    expect(process.env.DATABASE_URL ?? 'MISSING').not.toBe('MISSING')
  })
})
