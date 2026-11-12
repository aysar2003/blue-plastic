import { describe, expect, it } from 'vitest'

import {
  buildGroupCloseBlockers,
  isGroupCloseReady,
} from '@/lib/erp/group-close-gates'

describe('group close gates', () => {
  it('is ready when periods closed, IC matched, ownership set', () => {
    const blockers = buildGroupCloseBlockers({
      openOrMissingCount: 0,
      unmatchedIcCount: 0,
      currencyMismatch: false,
      currencies: ['USD'],
      ownershipIncomplete: false,
      asOf: '2026-11-11',
    })
    expect(blockers).toEqual([])
    expect(isGroupCloseReady(blockers)).toBe(true)
  })

  it('blocks on open periods, unmatched IC, and zero ownership', () => {
    const blockers = buildGroupCloseBlockers({
      openOrMissingCount: 2,
      unmatchedIcCount: 3,
      currencyMismatch: false,
      currencies: ['USD'],
      ownershipIncomplete: true,
      asOf: '2026-11-11',
    })
    expect(blockers).toHaveLength(3)
    expect(isGroupCloseReady(blockers)).toBe(false)
  })

  it('treats multi-currency as a warning, not a hard block', () => {
    const blockers = buildGroupCloseBlockers({
      openOrMissingCount: 0,
      unmatchedIcCount: 0,
      currencyMismatch: true,
      currencies: ['USD', 'SOS'],
      ownershipIncomplete: false,
      asOf: '2026-11-11',
    })
    expect(blockers.some((b) => b.includes('multiple currencies'))).toBe(true)
    expect(isGroupCloseReady(blockers)).toBe(true)
  })
})
