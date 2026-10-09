import { describe, expect, it } from 'vitest'

import { parseDocumentTemplate } from '@/lib/document-template'

describe('document template', () => {
  it('hides the classic paper until settings turn it on', () => {
    expect(parseDocumentTemplate(null).showClassicPaper).toBe(false)
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
  })
})
