import { describe, expect, it } from 'vitest'

import { formatMediaSize, sniffLogoImage, sniffTemplateMedia } from '@/lib/custom-template-media'

describe('custom template media', () => {
  it('accepts PDF by type or extension', () => {
    const byType = sniffTemplateMedia(new File(['%PDF'], 'a.bin', { type: 'application/pdf' }))
    expect(byType.ok).toBe(true)
    if (byType.ok) expect(byType.meta.kind).toBe('pdf')

    const byName = sniffTemplateMedia(new File(['%PDF'], 'bill.pdf', { type: '' }))
    expect(byName.ok).toBe(true)
    if (byName.ok) expect(byName.meta.kind).toBe('pdf')
  })

  it('accepts common image types', () => {
    const png = sniffTemplateMedia(new File(['x'], 'scan.png', { type: 'image/png' }))
    expect(png.ok).toBe(true)
    if (png.ok) expect(png.meta.kind).toBe('image')
  })

  it('rejects empty or unknown files', () => {
    expect(sniffTemplateMedia(new File([], 'empty.pdf', { type: 'application/pdf' })).ok).toBe(false)
    expect(sniffTemplateMedia(new File(['x'], 'notes.txt', { type: 'text/plain' })).ok).toBe(false)
  })

  it('formats sizes', () => {
    expect(formatMediaSize(500)).toBe('500 B')
    expect(formatMediaSize(2048)).toBe('2.0 KB')
  })

  it('accepts logo images only', () => {
    expect(sniffLogoImage(new File(['x'], 'mark.png', { type: 'image/png' })).ok).toBe(true)
    expect(sniffLogoImage(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })).ok).toBe(false)
  })
})

