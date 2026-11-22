import { describe, expect, it } from 'vitest'

import {
  PACK_IDS,
  assertPackCatalogComplete,
  orderHomeAppsForPack,
  primaryHubForPack,
  suggestedAddOnsForPack,
  verticalLauncherVisible,
  workspacePreview,
  PACK_FAMILIES,
} from '@/lib/packs'

describe('pack workspace catalog', () => {
  it('covers all 17 packs with hub + checklist', () => {
    expect(PACK_IDS).toHaveLength(17)
    expect(assertPackCatalogComplete()).toEqual({ ok: true })
  })

  it('maps school to Education desk with fees language', () => {
    const preview = workspacePreview('school')
    expect(preview).not.toBeNull()
    expect(preview!.hub.href).toBe('/education')
    expect(preview!.hub.label).toBe('Education')
    expect(preview!.daily.some((line) => /fee/i.test(line))).toBe(true)
    expect(preview!.underlyingLoops.some((loop) => loop.id === 'books')).toBe(true)
    expect(preview!.outOfScope.length).toBeGreaterThan(0)
  })

  it('maps hospital to Hospital desk', () => {
    expect(primaryHubForPack('hospital_admin').href).toBe('/hospital')
    expect(verticalLauncherVisible('hospital', 'hospital_admin')).toBe(true)
    expect(verticalLauncherVisible('education', 'hospital_admin')).toBe(false)
  })

  it('hides education launcher for retail', () => {
    expect(verticalLauncherVisible('education', 'retail')).toBe(false)
    expect(verticalLauncherVisible('pos', 'retail')).toBe(true)
  })

  it('orders education first for school pack', () => {
    const apps = [{ key: 'sales' }, { key: 'education' }, { key: 'banking' }]
    const ordered = orderHomeAppsForPack(apps, 'school', (rows) => [...rows])
    expect(ordered[0]?.key).toBe('education')
  })

  it('suggests inventory add-on for school', () => {
    expect(suggestedAddOnsForPack('school')).toContain('inventory')
  })

  it('families cover every pack id exactly once', () => {
    const seen = new Set<string>()
    for (const family of PACK_FAMILIES) {
      for (const id of family.packIds) {
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
    }
    expect(seen.size).toBe(PACK_IDS.length)
  })
})
