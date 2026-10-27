import { describe, expect, it } from 'vitest'

import { parseDocumentTemplate } from '@/lib/document-template'

describe('document template', () => {
  it('hides the classic paper until settings turn it on', () => {
    expect(parseDocumentTemplate(null).showClassicPaper).toBe(false)
    expect(parseDocumentTemplate(null).paperStyle).toBe('merchant')
    expect(parseDocumentTemplate(null).accent).toBe('#1eb8ae')
  })

  it('keeps bank lines and drops blanks', () => {
    const template = parseDocumentTemplate({
      accent: '#112233',
      terms: 'Pay in 30 days',
      showClassicPaper: true,
      banks: [
        { name: 'HORMUD MERCHANT', account: '700579' },
        { name: '', account: '' },
        { name: 'PREMIER WALLET', account: '187928' },
      ],
    })
    expect(template.banks).toEqual([
      { name: 'HORMUD MERCHANT', account: '700579' },
      { name: 'PREMIER WALLET', account: '187928' },
    ])
    expect(template.showClassicPaper).toBe(true)
    expect(template.terms).toBe('Pay in 30 days')
    expect(template.footerLayout).toBe('side')
  })

  it('keeps a footer title, note, and layout', () => {
    const template = parseDocumentTemplate({
      footerTitle: 'Akoonka shirkadda',
      footerNote: 'Magaca: AL FURAAT\nLaanta: Kismaayo',
      footerLayout: 'band',
      banks: [{ name: 'Salaam Bank', account: '1234567890' }],
    })
    expect(template.footerTitle).toBe('Akoonka shirkadda')
    expect(template.footerNote).toContain('Kismaayo')
    expect(template.footerLayout).toBe('band')
    expect(parseDocumentTemplate({ paperStyle: 'trade' }).paperStyle).toBe('trade')
    expect(parseDocumentTemplate({ paperStyle: 'nope' }).paperStyle).toBe('merchant')
    expect(parseDocumentTemplate({ footerLayout: 'nope' }).footerLayout).toBe('side')
  })
})
