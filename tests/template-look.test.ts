import { describe, expect, it } from 'vitest'

import { parseTemplateLook, serializeTemplateLook } from '@/lib/template-look'

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
      }),
    )
    expect(look.fontSize).toBe(18)
    expect(look.fontWeight).toBe('bold')
    expect(look.showLogo).toBe(false)
    expect(look.title).toBe('Quote')
    expect(look.accent).toBe('#112233')
  })

  it('falls back safely', () => {
    expect(parseTemplateLook('nope').fontSize).toBe(14)
    expect(parseTemplateLook(null, '#1eb8ae').accent).toBe('#1eb8ae')
  })
})
