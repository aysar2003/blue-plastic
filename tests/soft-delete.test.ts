import { afterAll, describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { trialBalance } from '@/server/accounting/balances'
import { deleteJournals } from '@/server/accounting/deletion'
import { postJournal } from '@/server/accounting/posting'
import { db, type Tx } from '@/server/db'
import { aging as receivablesAging } from '@/server/services/receivables.service'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

const RANGE = { from: '2026-01-01', to: '2026-12-31' } as const

async function postRent(tx: Tx, fixture: Fixture, amount: string, date = '2026-03-01') {
  return postJournal(tx, fixture.ctx, {
    date,
    memo: 'Rent',
    sourceType: 'MANUAL',
    lines: [
      { accountId: fixture.accounts[CODE.rent], debit: amount },
      { accountId: fixture.accounts[CODE.bank], credit: amount },
    ],
  })
}

/** Net movement on one account in the range, debits less credits. */
const movementOf = async (tx: Tx, fixture: Fixture, accountId: string): Promise<string> => {
  const { rows } = await trialBalance(fixture.ctx.orgId, RANGE, { client: tx, includeZero: true })
  const row = rows.find((candidate) => candidate.accountId === accountId)
  if (!row) return '0'
  return row.periodDebit.minus(row.periodCredit).toString()
}

/**
 * Deleting a transaction has to do two things that pull in opposite directions:
 * take the money off every report, and leave the evidence in the database. These
 * check both halves, because getting either one alone is a plausible-looking
 * failure.
 */
suite('deleting a journal takes it out of every balance', () => {
  it('removes the amount from the accounts it touched', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)

      await postRent(tx, fixture, '400')
      const kept = await postRent(tx, fixture, '150', '2026-03-05')

      expect(await movementOf(tx, fixture, fixture.accounts[CODE.rent])).toBe('550')

      const deleted = await postRent(tx, fixture, '900', '2026-03-09')
      expect(await movementOf(tx, fixture, fixture.accounts[CODE.rent])).toBe('1450')

      await deleteJournals(tx, fixture.ctx, [deleted.id], 'Entered twice')

      // Back to what it was before the deleted entry, on both sides.
      expect(await movementOf(tx, fixture, fixture.accounts[CODE.rent])).toBe('550')
      expect(await movementOf(tx, fixture, fixture.accounts[CODE.bank])).toBe('-550')

      // The entry that was not deleted is untouched.
      const survivor = await tx.journal.findUnique({
        where: { id: kept.id },
        select: { status: true, deletedAt: true },
      })
      expect(survivor?.status).toBe('POSTED')
      expect(survivor?.deletedAt).toBeNull()
    })
  })

  it('keeps the row, its lines and its amounts exactly as posted', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '275')

      await deleteJournals(tx, fixture.ctx, [journal.id], 'Wrong month')

      const after = await tx.journal.findUnique({
        where: { id: journal.id },
        select: {
          status: true,
          deletedAt: true,
          deletedById: true,
          deleteReason: true,
          journalNumber: true,
          lines: { select: { debit: true, credit: true } },
        },
      })

      expect(after).not.toBeNull()
      expect(after!.status).toBe('DELETED')
      expect(after!.deletedAt).toBeInstanceOf(Date)
      expect(after!.deletedById).toBe(fixture.ctx.userId)
      expect(after!.deleteReason).toBe('Wrong month')
      expect(after!.journalNumber).toBe(journal.journalNumber)

      // Nothing about what was posted has changed. That is the whole point of
      // keeping the row rather than removing it.
      expect(after!.lines).toHaveLength(2)
      const total = after!.lines.reduce((sum, line) => sum.plus(line.debit.toString()), new Decimal(0))
      expect(total.toString()).toBe('275')
    })
  })

  it('is idempotent — deleting twice changes nothing the second time', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '60')

      expect(await deleteJournals(tx, fixture.ctx, [journal.id], 'once')).toBe(1)
      expect(await deleteJournals(tx, fixture.ctx, [journal.id], 'twice')).toBe(0)

      const after = await tx.journal.findUnique({
        where: { id: journal.id },
        select: { deleteReason: true },
      })
      expect(after?.deleteReason).toBe('once')
    })
  })

  it('takes a reversal with the entry it reverses', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '90')

      const { reverseJournal } = await import('@/server/accounting/posting')
      const reversal = await reverseJournal(tx, fixture.ctx, journal.id, { reason: 'Correction' })

      await deleteJournals(tx, fixture.ctx, [journal.id], 'Both go')

      const [original, mirror] = await Promise.all([
        tx.journal.findUnique({ where: { id: journal.id }, select: { status: true } }),
        tx.journal.findUnique({ where: { id: reversal.id }, select: { status: true } }),
      ])

      expect(original?.status).toBe('DELETED')
      // Leaving the mirror behind would post the reverse of an entry that no
      // longer counts, which is exactly backwards.
      expect(mirror?.status).toBe('DELETED')
    })
  })

  it('drops out of the receivables aging with the rest of the ledger', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const customer = await tx.customer.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Deleted Balance Ltd' },
        select: { id: true },
      })

      const journal = await postJournal(tx, fixture.ctx, {
        date: '2026-02-01',
        memo: 'Opening balance',
        sourceType: 'MANUAL',
        lines: [
          { accountId: fixture.accounts[CODE.receivable], debit: '700', customerId: customer.id },
          { accountId: fixture.accounts[CODE.openingBalanceEquity], credit: '700' },
        ],
      })

      const before = await receivablesAging(fixture.ctx, '2026-06-30', { client: tx })
      expect(before.grandTotal.toString()).toBe('700')

      await deleteJournals(tx, fixture.ctx, [journal.id], 'Never owed it')

      const after = await receivablesAging(fixture.ctx, '2026-06-30', { client: tx })
      expect(after.grandTotal.toString()).toBe('0')
      expect(after.controlBalance.toString()).toBe('0')
      expect(after.agrees).toBe(true)
      expect(after.rows).toHaveLength(0)
    })
  })
})

/**
 * The immutability trigger is what makes the soft delete trustworthy: it permits
 * the one transition and nothing else, so "deleted" cannot become a back door
 * into editing a posted entry.
 */
suite('the ledger still refuses everything except the deletion transition', () => {
  it('refuses a deletion that does not record when', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '30')

      await expect(
        tx.$executeRaw`UPDATE journals SET status = 'DELETED' WHERE id = ${journal.id}`,
      ).rejects.toThrow(/without recording when/i)
    })
  })

  it('refuses to change an amount while marking the entry deleted', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '30')

      await expect(
        tx.$executeRaw`
          UPDATE journals
             SET status = 'DELETED', "deletedAt" = now(), memo = 'something else'
           WHERE id = ${journal.id}
        `,
      ).rejects.toThrow(/cannot be changed while it is being deleted/i)
    })
  })

  it('refuses to change an entry once it is deleted', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '30')
      await deleteJournals(tx, fixture.ctx, [journal.id], 'gone')

      await expect(
        tx.$executeRaw`UPDATE journals SET memo = 'back again' WHERE id = ${journal.id}`,
      ).rejects.toThrow(/has been deleted and cannot be changed/i)
    })
  })

  it('allows Trash restore: DELETED back to POSTED when the stamp clears', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '30')
      await deleteJournals(tx, fixture.ctx, [journal.id], 'gone')

      const { restoreJournals } = await import('@/server/accounting/deletion')
      await restoreJournals(tx, fixture.ctx, [journal.id])

      const after = await tx.journal.findUnique({
        where: { id: journal.id },
        select: { status: true, deletedAt: true },
      })
      expect(after?.status).toBe('POSTED')
      expect(after?.deletedAt).toBeNull()
      expect(await movementOf(tx, fixture, fixture.accounts[CODE.rent])).toBe('30')
    })
  })

  it('still refuses to physically delete a posted entry', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const journal = await postRent(tx, fixture, '30')

      await expect(
        tx.$executeRaw`DELETE FROM journals WHERE id = ${journal.id}`,
      ).rejects.toThrow(/posted and cannot be deleted/i)
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})
