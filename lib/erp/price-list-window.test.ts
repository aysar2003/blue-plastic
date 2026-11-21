import { describe, expect, it } from 'vitest'

import { isDateWindowActive } from '@/lib/erp/price-list-window'

describe('price list date window', () => {
  it('treats null bounds as always on', () => {
    expect(isDateWindowActive('2026-11-21', null, null)).toBe(true)
  })

  it('includes start and end dates', () => {
    expect(isDateWindowActive('2026-11-21', '2026-11-21', '2026-11-30')).toBe(true)
    expect(isDateWindowActive('2026-11-20', '2026-11-21', '2026-11-30')).toBe(false)
    expect(isDateWindowActive('2026-12-01', '2026-11-21', '2026-11-30')).toBe(false)
  })
})
