import { afterAll, describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { db } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('posting engine', () => {
  it('posts a balanced journal, numbers it, and records both sides', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const posted = await postJournal(tx, ctx, {
        date: '2026-03-15',
        memo: 'March rent',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '1500.00' },
          { accountId: accounts[CODE.bank], credit: '1500.00' },
        ],
      })

      expect(posted.journalNumber).toBe('JE-00001')
      expect(posted.total).toBe('1500.00')

      const lines = await tx.journalLine.findMany({
        where: { journalId: posted.id },
        orderBy: { lineNumber: 'asc' },
        select: { debit: true, credit: true, accountId: true, journalDate: true },
      })

      expect(lines).toHaveLength(2)
      expect(lines[0].debit.toString()).toBe('1500')
      expect(lines[1].credit.toString()).toBe('1500')
      // journalDate is set by trigger from the header, never trusted from the caller.
      expect(lines[0].journalDate.toISOString().slice(0, 10)).toBe('2026-03-15')
    })
  })

  it('creates the fiscal year and period on first use', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const posted = await postJournal(tx, ctx, {
        date: '2026-07-04',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.cash], debit: '10' },
          { accountId: accounts[CODE.sales], credit: '10' },
        ],
      })

      const period = await tx.accountingPeriod.findUnique({
        where: { id: posted.periodId },
        select: { periodNumber: true, fiscalYear: { select: { year: true } } },
      })

      expect(period?.fiscalYear.year).toBe(2026)
      expect(period?.periodNumber).toBe(7)

      // Thirteen periods: twelve months plus period 0 for opening balances.
      const count = await tx.accountingPeriod.count({ where: { orgId: ctx.orgId } })
      expect(count).toBe(13)
    })
  })

  it('rejects an unbalanced journal with the difference named', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'MANUAL',
          lines: [
            { accountId: accounts[CODE.rent], debit: '1500.00' },
            { accountId: accounts[CODE.bank], credit: '1400.00' },
          ],
        }),
      ).rejects.toThrow(/out of balance by 100\.00/i)
    })
  })

  it('rejects a one-line journal', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'MANUAL',
          lines: [{ accountId: accounts[CODE.rent], debit: '100' }],
        }),
      ).rejects.toThrow(/at least two lines/i)
    })
  })

  it('rejects a line that is both a debit and a credit', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'MANUAL',
          lines: [
            { accountId: accounts[CODE.rent], debit: '100', credit: '50' },
            { accountId: accounts[CODE.bank], credit: '50' },
          ],
        }),
      ).rejects.toThrow(/either a debit or a credit/i)
    })
  })

  it('rejects negative amounts rather than silently flipping them', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'MANUAL',
          lines: [
            { accountId: accounts[CODE.rent], debit: '-100' },
            { accountId: accounts[CODE.bank], credit: '-100' },
          ],
        }),
      ).rejects.toThrow(/cannot be negative/i)
    })
  })

  it('drops lines that round to nothing, then still requires two', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const posted = await postJournal(tx, ctx, {
        date: '2026-03-15',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '100.00' },
          { accountId: accounts[CODE.utilities], debit: '0.001' }, // rounds to 0.00
          { accountId: accounts[CODE.bank], credit: '100.00' },
        ],
      })

      const count = await tx.journalLine.count({ where: { journalId: posted.id } })
      expect(count).toBe(2)
    })
  })

  it('refuses to post to an archived account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)
      await tx.ledgerAccount.update({
        where: { id: accounts[CODE.utilities] },
        data: { isActive: false },
      })

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'MANUAL',
          lines: [
            { accountId: accounts[CODE.utilities], debit: '50' },
            { accountId: accounts[CODE.bank], credit: '50' },
          ],
        }),
      ).rejects.toThrow(/archived/i)
    })
  })

  it('allows posting to a Main that has sub-accounts', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      // Nest Utilities under Rent — both remain postable.
      await tx.ledgerAccount.update({
        where: { id: accounts[CODE.utilities] },
        data: { parentId: accounts[CODE.rent] },
      })

      const journal = await postJournal(tx, ctx, {
        date: '2026-03-15',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '50' },
          { accountId: accounts[CODE.bank], credit: '50' },
        ],
      })
      expect(journal.id).toBeTruthy()
      expect(journal.journalNumber).toBeTruthy()
    })
  })

  it('requires a customer on an Accounts Receivable line (R7)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'INVOICE',
          lines: [
            { accountId: accounts[CODE.receivable], debit: '250' },
            { accountId: accounts[CODE.sales], credit: '250' },
          ],
        }),
      ).rejects.toThrow(/must name a customer/i)
    })
  })

  it('requires a vendor on an Accounts Payable line (R7)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-15',
          sourceType: 'BILL',
          lines: [
            { accountId: accounts[CODE.rent], debit: '250' },
            { accountId: accounts[CODE.payable], credit: '250' },
          ],
        }),
      ).rejects.toThrow(/must name a vendor/i)
    })
  })

  it('will not post into a closed period', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const first = await postJournal(tx, ctx, {
        date: '2026-03-15',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '10' },
          { accountId: accounts[CODE.bank], credit: '10' },
        ],
      })

      await tx.accountingPeriod.update({
        where: { id: first.periodId },
        data: { status: 'CLOSED' },
      })

      await expect(
        postJournal(tx, ctx, {
          date: '2026-03-20',
          sourceType: 'MANUAL',
          lines: [
            { accountId: accounts[CODE.rent], debit: '10' },
            { accountId: accounts[CODE.bank], credit: '10' },
          ],
        }),
      ).rejects.toThrow(/closed/i)
    })
  })

  it('honours an idempotency key instead of posting twice', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const draft = {
        date: '2026-03-15' as const,
        sourceType: 'MANUAL' as const,
        idempotencyKey: 'retry-me',
        lines: [
          { accountId: accounts[CODE.rent], debit: '75' },
          { accountId: accounts[CODE.bank], credit: '75' },
        ],
      }

      const first = await postJournal(tx, ctx, draft)
      const second = await postJournal(tx, ctx, draft)

      expect(second.id).toBe(first.id)
      expect(await tx.journal.count({ where: { orgId: ctx.orgId } })).toBe(1)
    })
  })
})

suite('reversal', () => {
  it('mirrors the original, links both ways, and nets the ledger to zero', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const original = await postJournal(tx, ctx, {
        date: '2026-03-15',
        memo: 'Rent paid twice by mistake',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '1500' },
          { accountId: accounts[CODE.bank], credit: '1500' },
        ],
      })

      const reversal = await reverseJournal(tx, ctx, original.id, {
        date: '2026-03-16',
        reason: 'Duplicate entry',
      })

      const reversalLines = await tx.journalLine.findMany({
        where: { journalId: reversal.id },
        orderBy: { lineNumber: 'asc' },
        select: { accountId: true, debit: true, credit: true },
      })

      // Rent was debited; on the reversal it is credited.
      const rentLine = reversalLines.find((line) => line.accountId === accounts[CODE.rent])
      expect(rentLine?.credit.toString()).toBe('1500')
      expect(rentLine?.debit.toString()).toBe('0')

      const originalAfter = await tx.journal.findUnique({
        where: { id: original.id },
        select: { status: true, reversedBy: { select: { id: true } } },
      })
      expect(originalAfter?.status).toBe('REVERSED')
      expect(originalAfter?.reversedBy?.id).toBe(reversal.id)

      // Both journals remain in the ledger and cancel out.
      const totals = await tx.journalLine.aggregate({
        where: { orgId: ctx.orgId, accountId: accounts[CODE.rent] },
        _sum: { debit: true, credit: true },
      })
      const net = new Decimal(totals._sum.debit?.toString() ?? '0').minus(
        totals._sum.credit?.toString() ?? '0',
      )
      expect(net.toString()).toBe('0')
    })
  })

  it('refuses to reverse the same journal twice', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const original = await postJournal(tx, ctx, {
        date: '2026-03-15',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '10' },
          { accountId: accounts[CODE.bank], credit: '10' },
        ],
      })

      await reverseJournal(tx, ctx, original.id, { date: '2026-03-15', reason: 'first' })

      await expect(
        reverseJournal(tx, ctx, original.id, { date: '2026-03-15', reason: 'second' }),
      ).rejects.toThrow(/already been reversed/i)
    })
  })

  it('dates a reversal into the first open period when the original month is closed', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const original = await postJournal(tx, ctx, {
        date: '2026-03-15',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '10' },
          { accountId: accounts[CODE.bank], credit: '10' },
        ],
      })

      await tx.accountingPeriod.update({
        where: { id: original.periodId },
        data: { status: 'CLOSED' },
      })

      const reversal = await reverseJournal(tx, ctx, original.id, { reason: 'Correction' })

      // April, not March: correcting an error must not reopen a reported month.
      expect(reversal.date.toISOString().slice(0, 10)).toBe('2026-04-01')
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})
