import { describe, expect, it } from 'vitest'

import { listQuerySchema, moneyString, paginate, paged, parseListQuery } from './common'

describe('list query', () => {
  it('applies defaults that open the whole list', () => {
    expect(listQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50_000, dir: 'asc' })
  })

  it('accepts a large page size so a sheet can load every row', () => {
    expect(listQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(true)
    expect(parseListQuery({ pageSize: '1000' }).pageSize).toBe(1000)
  })

  it('falls back to defaults on nonsense input rather than throwing', () => {
    expect(parseListQuery({ page: 'banana' })).toMatchObject({ page: 1, pageSize: 50_000 })
  })

  it('takes the first value of a repeated parameter', () => {
    expect(parseListQuery({ q: ['acme', 'other'] }).q).toBe('acme')
  })

  it('computes skip and take for callers that still page in memory', () => {
    expect(paginate({ page: 3, pageSize: 25, dir: 'asc' })).toEqual({ skip: 50, take: 25 })
  })

  it('reports at least one page even when empty', () => {
    expect(paged([], 0, { page: 1, pageSize: 25, dir: 'asc' }).pageCount).toBe(1)
  })
})

describe('moneyString', () => {
  it('accepts decimal strings within storage scale', () => {
    for (const value of ['0', '10', '10.5', '-10.5000', '1234567.1234', '120-10']) {
      expect(moneyString.safeParse(value).success, value).toBe(true)
    }
    expect(moneyString.parse('120-10')).toBe('110')
    expect(moneyString.parse('2*50')).toBe('100')
  })
})
