import { describe, expect, it } from 'vitest'

import { looksLikePhone, normalizePhone, parseLoginIdentifier } from '@/lib/phone'

describe('normalizePhone', () => {
  it('keeps E.164', () => {
    expect(normalizePhone('+252612345678')).toBe('+252612345678')
  })

  it('adds default Somalia country code for local mobiles', () => {
    expect(normalizePhone('0612345678')).toBe('+252612345678')
    expect(normalizePhone('612345678')).toBe('+252612345678')
  })

  it('rejects empty and short values', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('123')).toBeNull()
  })
})

describe('parseLoginIdentifier', () => {
  it('parses email', () => {
    expect(parseLoginIdentifier('Ali@Example.com')).toEqual({
      kind: 'email',
      value: 'ali@example.com',
    })
  })

  it('parses phone', () => {
    expect(parseLoginIdentifier('+252 61 2345678')).toEqual({
      kind: 'phone',
      value: '+252612345678',
    })
  })

  it('detects phone vs email', () => {
    expect(looksLikePhone('612345678')).toBe(true)
    expect(looksLikePhone('a@b.com')).toBe(false)
  })
})
