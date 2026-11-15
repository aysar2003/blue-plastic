import { describe, expect, it } from 'vitest'

import { skuFromName } from '@/lib/sku'
import { localizationPackById } from '@/lib/localization/packs'

describe('master-data heal helpers', () => {
  it('skuFromName fills blanks uniquely', () => {
    const taken = new Set<string>()
    const a = skuFromName('Biyo 1.5L', taken)
    taken.add(a.toLowerCase())
    const b = skuFromName('Biyo 1.5L', taken)
    expect(a).toBe('BIYO-15L')
    expect(b).toBe('BIYO-15L-2')
  })

  it('pack country is available for org heal', () => {
    expect(localizationPackById('so')?.country).toBe('SO')
    expect(localizationPackById('ke')?.country).toBe('KE')
  })
})
