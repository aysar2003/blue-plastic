import { describe, expect, it } from 'vitest'

import {
  applyTemplateLookPreset,
  parseTemplateLook,
  serializeTemplateLook,
  TEMPLATE_LOOK_PRESETS,
} from '@/lib/template-look'

describe('template look', () => {
  it('parses style overrides', () => {
    const look = parseTemplateLook(
      serializeTemplateLook({
        fontFamily: 'Georgia, serif',
        fontSize: 18,
        fontWeight: 'bold',
        accent: '#112233',
        borderColor: '#aabbcc',
        borderWidth: 3,
        showLogo: false,
        title: 'Quote',
        headerStyle: 'band',
        density: 'compact',
        radius: 12,
        showBanks: false,
        showTerms: true,
        presetId: 'modern',
      }),
    )
    expect(look.fontSize).toBe(18)
    expect(look.fontWeight).toBe('bold')
    expect(look.showLogo).toBe(false)
    expect(look.title).toBe('Quote')
    expect(look.accent).toBe('#112233')
    expect(look.headerStyle).toBe('band')
    expect(look.density).toBe('compact')
    expect(look.radius).toBe(12)
    expect(look.showBanks).toBe(false)
    expect(look.presetId).toBe('modern')
  })

  it('falls back safely', () => {
    expect(parseTemplateLook('nope').fontSize).toBe(14)
    expect(parseTemplateLook(null, '#1eb8ae').accent).toBe('#1eb8ae')
    expect(parseTemplateLook(null).headerStyle).toBe('line')
    expect(parseTemplateLook(null).presetId).toBe('professional')
  })

  it('applies visible style presets without losing accent', () => {
    const base = parseTemplateLook(null, '#112233')
    const modern = applyTemplateLookPreset('modern', base)
    expect(modern.presetId).toBe('modern')
    expect(modern.headerStyle).toBe('band')
    expect(modern.accent).toBe('#112233')
    expect(TEMPLATE_LOOK_PRESETS).toHaveLength(5)

    const classic = applyTemplateLookPreset('classic', base)
    expect(classic.fontFamily).toContain('Georgia')
    expect(classic.radius).toBe(0)
  })
})
