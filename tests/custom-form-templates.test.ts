import { describe, expect, it } from 'vitest'

import {
  newCustomTemplateId,
  parseCustomFormTemplates,
  serializeCustomFormTemplates,
} from '@/lib/custom-form-templates'

describe('custom form templates', () => {
  it('returns empty for missing or bad input', () => {
    expect(parseCustomFormTemplates(null)).toEqual([])
    expect(parseCustomFormTemplates('not-json')).toEqual([])
    expect(parseCustomFormTemplates('{}')).toEqual([])
  })

  it('round-trips a named document template', () => {
    const id = newCustomTemplateId()
    const raw = serializeCustomFormTemplates([
      {
        id,
        name: 'Hormud paper',
        kind: 'document',
        note: 'Hospital branch',
        createdAt: '2026-10-12T00:00:00.000Z',
        document: {
          accent: '#1eb8ae',
          banks: [{ name: 'Hormud', account: '615' }],
          terms: 'Net 7',
          showClassicPaper: false,
        },
      },
    ])
    const parsed = parseCustomFormTemplates(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.name).toBe('Hormud paper')
    expect(parsed[0]?.document?.banks[0]?.name).toBe('Hormud')
  })

  it('keeps other/placeholder kinds without requiring a document', () => {
    const parsed = parseCustomFormTemplates(
      JSON.stringify([
        {
          id: 'tpl_1',
          name: 'Coming soon',
          kind: 'other',
          note: 'Will add later',
          createdAt: '2026-10-12T00:00:00.000Z',
        },
      ]),
    )
    expect(parsed[0]?.kind).toBe('other')
    expect(parsed[0]?.document).toBeUndefined()
  })

  it('keeps PDF/image media metadata on a template', () => {
    const parsed = parseCustomFormTemplates(
      JSON.stringify([
        {
          id: 'tpl_pdf',
          name: 'Invoice scan',
          kind: 'media',
          note: 'From phone',
          createdAt: '2026-10-12T00:00:00.000Z',
          media: {
            kind: 'pdf',
            contentType: 'application/pdf',
            fileName: 'invoice.pdf',
            sizeBytes: 12000,
          },
        },
      ]),
    )
    expect(parsed[0]?.kind).toBe('media')
    expect(parsed[0]?.media?.fileName).toBe('invoice.pdf')
  })
})

