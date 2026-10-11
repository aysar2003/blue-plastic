import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_STYLE,
  FONT_SIZES,
  FONT_STYLES,
  parseFontSize,
  parseFontStyle,
} from '@/lib/ui-fonts'

describe('ui fonts', () => {
  it('lists size and style choices', () => {
    expect(FONT_SIZES.map((item) => item.id)).toEqual(['sm', 'md', 'lg', 'xl'])
    expect(FONT_STYLES.map((item) => item.id)).toEqual([
      'default',
      'geist',
      'inter',
      'source-sans',
      'system',
    ])
  })

  it('accepts known ids and falls back for junk', () => {
    expect(parseFontSize('lg')).toBe('lg')
    expect(parseFontSize(null)).toBe(DEFAULT_FONT_SIZE)
    expect(parseFontSize('huge')).toBe(DEFAULT_FONT_SIZE)
    expect(parseFontStyle('inter')).toBe('inter')
    expect(parseFontStyle(null)).toBe(DEFAULT_FONT_STYLE)
    expect(parseFontStyle('comic')).toBe(DEFAULT_FONT_STYLE)
  })
})
