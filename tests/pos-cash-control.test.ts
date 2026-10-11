import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  buildPosCashMoveJournal,
  buildPosSessionCloseJournal,
} from '@/server/accounting/builders/pos'

describe('buildPosCashMoveJournal', () => {
  it('debits the till on cash in', () => {
    const journal = buildPosCashMoveJournal({
      date: '2026-10-10',
      kind: 'IN',
      movementId: 'move-1',
      registerAccountId: 'till',
      counterpartyAccountId: 'bank',
      amount: '50',
      registerName: 'Front',
    })
    expect(journal.sourceType).toBe('POS_CASH_MOVE')
    expect(journal.lines.map((line) => ({ ...line, debit: line.debit?.toString(), credit: line.credit?.toString() }))).toEqual([
      { accountId: 'till', debit: '50', credit: undefined, description: 'POS cash in · Front' },
      { accountId: 'bank', debit: undefined, credit: '50', description: 'POS cash in · Front' },
    ])
  })

  it('credits the till on cash out', () => {
    const journal = buildPosCashMoveJournal({
      date: '2026-10-10',
      kind: 'OUT',
      movementId: 'move-2',
      registerAccountId: 'till',
      counterpartyAccountId: 'bank',
      amount: '20',
      registerName: 'Front',
      reason: 'Float to safe',
    })
    expect(journal.memo).toBe('Float to safe')
    expect(journal.lines[0]?.accountId).toBe('bank')
    expect(new Decimal(journal.lines[0]?.debit ?? 0).toString()).toBe('20')
    expect(journal.lines[1]?.accountId).toBe('till')
    expect(new Decimal(journal.lines[1]?.credit ?? 0).toString()).toBe('20')
  })
})

describe('buildPosSessionCloseJournal', () => {
  it('posts cash short to the expense account', () => {
    const journal = buildPosSessionCloseJournal({
      date: '2026-10-10',
      sessionId: 'sess-1',
      registerAccountId: 'till',
      differenceAccountId: 'short',
      amount: '-5',
      registerName: 'Front',
      over: false,
    })
    expect(journal?.sourceType).toBe('POS_SESSION_CLOSE')
    expect(journal?.lines[0]?.accountId).toBe('short')
    expect(new Decimal(journal?.lines[0]?.debit ?? 0).toString()).toBe('5')
    expect(journal?.lines[1]?.accountId).toBe('till')
    expect(new Decimal(journal?.lines[1]?.credit ?? 0).toString()).toBe('5')
  })

  it('posts cash over to the income account', () => {
    const journal = buildPosSessionCloseJournal({
      date: '2026-10-10',
      sessionId: 'sess-2',
      registerAccountId: 'till',
      differenceAccountId: 'over',
      amount: '3',
      registerName: 'Front',
      over: true,
    })
    expect(journal?.lines[0]?.accountId).toBe('till')
    expect(new Decimal(journal?.lines[0]?.debit ?? 0).toString()).toBe('3')
    expect(journal?.lines[1]?.accountId).toBe('over')
    expect(new Decimal(journal?.lines[1]?.credit ?? 0).toString()).toBe('3')
  })

  it('skips a zero difference', () => {
    expect(
      buildPosSessionCloseJournal({
        date: '2026-10-10',
        sessionId: 'sess-3',
        registerAccountId: 'till',
        differenceAccountId: 'short',
        amount: '0',
        registerName: 'Front',
        over: false,
      }),
    ).toBeNull()
  })
})
