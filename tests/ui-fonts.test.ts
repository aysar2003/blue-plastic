import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_SIZE_PX,
  DEFAULT_FONT_STYLE,
  FONT_SIZES,
  FONT_STYLES,
  parseFontSize,
  parseFontSizePx,
  parseFontStyle,
  parseFontStyleCustom,
} from '@/lib/ui-fonts'

describe('ui fonts', () => {
  it('lists expanded size and style choices including custom', () => {
    expect(FONT_SIZES.map((item) => item.id)).toEqual([
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
      'custom',
    ])
    expect(FONT_STYLES.map((item) => item.id)).toEqual([
      'default',
      'geist',
      'inter',
      'source-sans',
      'jakarta',
      'fraunces',
      'mono',
      'georgia',
      'system',
      'custom',
    ])
  })

  it('accepts known ids and falls back for junk', () => {
    expect(parseFontSize('lg')).toBe('lg')
    expect(parseFontSize('xs')).toBe('xs')
    expect(parseFontSize('custom')).toBe('custom')
    expect(parseFontSize(null)).toBe(DEFAULT_FONT_SIZE)
    expect(parseFontSize('huge')).toBe(DEFAULT_FONT_SIZE)
    expect(parseFontStyle('inter')).toBe('inter')
    expect(parseFontStyle('jakarta')).toBe('jakarta')
    expect(parseFontStyle('custom')).toBe('custom')
    expect(parseFontStyle(null)).toBe(DEFAULT_FONT_STYLE)
    expect(parseFontStyle('comic')).toBe(DEFAULT_FONT_STYLE)
  })

  it('clamps custom pixel size and sanitizes custom stacks', () => {
    expect(parseFontSizePx('16')).toBe(16)
    expect(parseFontSizePx('3')).toBe(11)
    expect(parseFontSizePx('99')).toBe(22)
    expect(parseFontSizePx(null)).toBe(DEFAULT_FONT_SIZE_PX)
    expect(parseFontStyleCustom('Georgia, serif')).toBe('Georgia, serif')
    expect(parseFontStyleCustom('url(evil)')).toBe(
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    )
  })
})
