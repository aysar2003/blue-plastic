import { describe, expect, it } from 'vitest'

import {
  PACK_IDS,
  behavioralWithNeeds,
  defaultNeedsSelection,
  modulesWithNeeds,
  needsForPack,
} from '@/lib/packs'

describe('register needs', () => {
  it('gives every pack a rich dedicated Needs list (17/17)', () => {
    expect(PACK_IDS).toHaveLength(17)
    for (const id of PACK_IDS) {
      const needs = needsForPack(id)
      expect(needs.length, id).toBeGreaterThanOrEqual(8)
    }
  })

  it('exposes many school needs beyond payroll/tax', () => {
    const needs = needsForPack('school')
    expect(needs.length).toBeGreaterThanOrEqual(10)
    expect(needs.some((n) => n.id === 'classes')).toBe(true)
    expect(needs.some((n) => n.id === 'transport')).toBe(true)
    expect(needs.some((n) => n.id === 'portal')).toBe(true)
    expect(needs.some((n) => n.id === 'inventory')).toBe(true)
  })

  it('turns on inventory when school selects canteen stock', () => {
    const selected = Object.entries(defaultNeedsSelection('school'))
      .filter(([, on]) => on)
      .map(([id]) => id)
    selected.push('inventory')
    const modules = modulesWithNeeds('school', selected as never)
    expect(modules.inventory).toBe(true)
    expect(modules.stores).toBe(true)
  })

  it('enables parent portal behavioral flag', () => {
    const flags = behavioralWithNeeds('school', ['portal', 'payroll'])
    expect(flags.enableCustomerPortal).toBe(true)
    expect(flags.payrollStandard).toBe(true)
    expect(flags.enableTax).toBe(false)
  })

  it('gives ngo and construction pack-specific needs', () => {
    expect(needsForPack('ngo').some((n) => /fund|grant|donor/i.test(n.label + n.hint))).toBe(true)
    expect(needsForPack('construction').some((n) => /progress|job|subcontract/i.test(n.label + n.hint))).toBe(
      true,
    )
  })
})
