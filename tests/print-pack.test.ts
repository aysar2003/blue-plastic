import { describe, expect, it } from 'vitest'

import { printPackSectionClass } from '@/lib/print-pack'

describe('printPackSectionClass', () => {
  it('starts later papers on a new page and ends earlier papers before the next', () => {
    expect(printPackSectionClass(0, 3)).toBe('scroll-mt-20 print:mt-0 break-after-page')
    expect(printPackSectionClass(1, 3)).toBe(
      'scroll-mt-20 print:mt-0 mt-8 break-before-page break-after-page',
    )
    expect(printPackSectionClass(2, 3)).toBe('scroll-mt-20 print:mt-0 mt-8 break-before-page')
  })

  it('does not force a trailing break on a single paper', () => {
    expect(printPackSectionClass(0, 1)).toBe('scroll-mt-20 print:mt-0')
  })
})
