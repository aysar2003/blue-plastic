import { describe, expect, it } from 'vitest'

import { letterheadOf } from '@/lib/letterhead'

describe('letterheadOf', () => {
  it('strips trailing commas so addresses do not print as Store,, Street', () => {
    const block = letterheadOf({
      name: 'AL FURAAT',
      addressLine1: 'Furaat Store,',
      addressLine2: 'Baicad Street',
      city: 'Kismaayo',
      country: 'SOMALIA',
    })
    expect(block.address).not.toMatch(/,,/)
    expect(block.address).toContain('Furaat Store, Baicad Street')
  })
})
