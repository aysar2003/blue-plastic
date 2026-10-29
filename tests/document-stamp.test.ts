import { describe, expect, it } from 'vitest'

import { documentStampLines } from '@/lib/document-stamp'

describe('documentStampLines', () => {
  it('formats audit lines for Change history / email (not the printed paper)', () => {
    expect(
      documentStampLines({
        createdBy: 'Zakariye Abdisalam Noor',
        approvedBy: 'Riaan Slabbert',
        approvedAt: new Date('2025-10-29T00:00:00.000Z'),
        status: 'CLOSED',
      }),
    ).toEqual([
      'Created By: Zakariye Abdisalam Noor',
      'Approved By: Riaan Slabbert',
      'Approved Date: 2025-10-29',
      'Status: Closed',
    ])
  })

  it('keeps the block when nobody has approved yet', () => {
    expect(
      documentStampLines({
        createdBy: null,
        approvedBy: null,
        approvedAt: null,
        status: 'DRAFT',
      }),
    ).toEqual([
      'Created By: —',
      'Approved By: —',
      'Approved Date: —',
      'Status: Draft',
    ])
  })
})
