import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppGlyph, GLYPH_COLORS, isAppGlyph } from '@/components/layout/app-glyphs'
import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'

describe('app glyphs', () => {
  it('gives every launcher app its own flat colour mark', () => {
    for (const app of LAUNCHER_APPS) {
      expect(isAppGlyph(app.glyph), app.key).toBe(true)
    }
    expect(new Set(LAUNCHER_APPS.map((app) => app.glyph)).size).toBe(LAUNCHER_APPS.length)
  })

  it('draws inline, decorative SVG in the shared palette only', () => {
    const palette = new Set(Object.values(GLYPH_COLORS).map((c) => c.toLowerCase()))
    for (const app of LAUNCHER_APPS) {
      const html = renderToStaticMarkup(createElement(AppGlyph, { name: app.glyph, className: 'size-12' }))
      expect(html.startsWith('<svg'), app.key).toBe(true)
      expect(html).toContain('viewBox="0 0 48 48"')
      expect(html).toContain('aria-hidden="true"')
      expect(html).not.toMatch(/<(image|use|text)\b|href=/)
      const colours = [...html.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase())
      expect(colours.length, app.key).toBeGreaterThan(1)
      for (const colour of colours) expect(palette.has(colour), `${app.key} ${colour}`).toBe(true)
      expect(new Set(colours).size, `${app.key} is multi-colour`).toBeGreaterThan(1)
    }
  })

  it('rejects names without a mark', () => {
    expect(isAppGlyph('invoices')).toBe(false)
    expect(isAppGlyph(undefined)).toBe(false)
    expect(isAppGlyph('toString')).toBe(false)
    expect(isAppGlyph('items')).toBe(true)
  })
})
