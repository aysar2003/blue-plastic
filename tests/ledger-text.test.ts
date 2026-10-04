import { describe, expect, it } from 'vitest'

import { postedLineParts } from '@/lib/ledger-text'

describe('posted line text', () => {
  it('splits an opening balance into the type and the registered name', () => {
    expect(
      postedLineParts({
        sourceLabel: 'Opening balance',
        memo: 'Opening balance — UNION GROUP',
        description: null,
        partyName: null,
      }),
    ).toEqual({ name: 'UNION GROUP', note: null })
  })

  it('keeps a real memo when the line already names the customer', () => {
    expect(
      postedLineParts({
        sourceLabel: 'Manual journal',
        memo: 'Tijaabo 1 — lacag cash macmiil',
        description: null,
        partyName: 'AL FURAAT 1',
      }),
    ).toEqual({ name: 'AL FURAAT 1', note: 'Tijaabo 1 — lacag cash macmiil' })
  })

  it('leaves an item description beside the customer', () => {
    expect(
      postedLineParts({
        sourceLabel: 'Invoice',
        memo: null,
        description: 'BURUSH 3" EMIRAT',
        partyName: 'UNION GROUP',
      }),
    ).toEqual({ name: 'UNION GROUP', note: 'BURUSH 3" EMIRAT' })
  })
})
