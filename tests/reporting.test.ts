import { afterAll, describe, expect, it } from 'vitest'

import { balancesAsOf, generalLedger, naturalBalance, trialBalance } from '@/server/accounting/balances'
import { postJournal, reverseJournal } from '@/server/accounting/posting'
import { db } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

describe('natural balance', () => {
  it('presents each account on its own side', () => {
    // An asset with 100 debited reads as 100.
    expect(naturalBalance('ASSET', '100', '0').toString()).toBe('100')
    // Revenue with 100 credited also reads as 100, not -100.
    expect(naturalBalance('REVENUE', '0', '100').toString()).toBe('100')
    expect(naturalBalance('LIABILITY', '0', '250').toString()).toBe('250')
    expect(naturalBalance('EXPENSE', '80', '0').toString()).toBe('80')
    // A contra position still reads negative, which is the point.
    expect(naturalBalance('ASSET', '0', '30').toString()).toBe('-30')
  })
})

/**
 * The trial balance and the general ledger read the same rows through different
 * queries. If they ever disagree, one of them is lying — so the tests check the
 * numbers against each other, not only against an expected constant.
 */
suite('trial balance', () => {
  it('nets to zero, and agrees with the ledger account by account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await postJournal(tx, ctx, {
        date: '2026-02-01',
        memo: 'Owner puts in capital',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.bank], debit: '50000' },
          { accountId: accounts[CODE.capital], credit: '50000' },
        ],
      })

      await postJournal(tx, ctx, {
        date: '2026-03-05',
        memo: 'Cash sale',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.bank], debit: '1250.50' },
          { accountId: accounts[CODE.sales], credit: '1250.50' },
        ],
      })

      await postJournal(tx, ctx, {
        date: '2026-03-06',
        memo: 'March rent',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '900' },
          { accountId: accounts[CODE.bank], credit: '900' },
        ],
      })

      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      // The ledger's own self-check.
      expect(report.balanced).toBe(true)
      expect(report.totalDebit.toString()).toBe(report.totalCredit.toString())

      const bank = report.rows.find((row) => row.code === CODE.bank)
      // 50,000 in + 1,250.50 in - 900 out, sitting on the debit side.
      expect(bank?.closingDebit.toString()).toBe('50350.5')
      expect(bank?.closingCredit.toString()).toBe('0')

      const sales = report.rows.find((row) => row.code === CODE.sales)
      // Revenue lands on the credit side, as revenue does.
      expect(sales?.closingCredit.toString()).toBe('1250.5')

      const rent = report.rows.find((row) => row.code === CODE.rent)
      expect(rent?.closingDebit.toString()).toBe('900')

      // Accounts with no activity are left out unless asked for.
      expect(report.rows.some((row) => row.code === CODE.utilities)).toBe(false)

      // The register must agree with the trial balance, account by account.
      const ledger = await generalLedger(
        ctx.orgId,
        accounts[CODE.bank],
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      expect(ledger.entries).toHaveLength(3)
      expect(ledger.closing.toString()).toBe('50350.5')
      expect(ledger.entries[ledger.entries.length - 1].balance.toString()).toBe('50350.5')
      // Each entry names the other side of its journal.
      expect(ledger.entries[0].contraAccounts).toContain("Owner's Capital")

      const balances = await balancesAsOf(ctx.orgId, '2026-12-31', { client: tx })
      expect(balances.get(accounts[CODE.bank])?.natural.toString()).toBe('50350.5')
    })
  })

  it('keeps a reversed pair in the ledger and nets it to nothing', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const posted = await postJournal(tx, ctx, {
        date: '2026-03-10',
        sourceType: 'MANUAL',
        lines: [
          { accountId: accounts[CODE.rent], debit: '400' },
          { accountId: accounts[CODE.bank], credit: '400' },
        ],
      })

      await reverseJournal(tx, ctx, posted.id, { date: '2026-03-11', reason: 'Wrong account' })

      // Both journals are still there — nothing was erased.
      expect(await tx.journal.count({ where: { orgId: ctx.orgId } })).toBe(2)

      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      // A report that excluded reversed journals would show 400 here, backwards.
      const rent = report.rows.find((row) => row.code === CODE.rent)
      expect(rent === undefined || rent.closingDebit.isZero()).toBe(true)
      expect(report.balanced).toBe(true)

      // The register still shows both sides of the story.
      const ledger = await generalLedger(
        ctx.orgId,
        accounts[CODE.rent],
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      expect(ledger.entries).toHaveLength(2)
      expect(ledger.closing.toString()).toBe('0')
    })
  })

  it('puts an opening balance against Opening Balance Equity', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await postJournal(tx, ctx, {
        date: '2025-12-31',
        memo: 'Opening balance — bank',
        sourceType: 'OPENING_BALANCE',
        lines: [
          { accountId: accounts[CODE.bank], debit: '12000' },
          { accountId: accounts[CODE.openingBalanceEquity], credit: '12000' },
        ],
      })

      const balances = await balancesAsOf(ctx.orgId, '2026-01-01', { client: tx })
      expect(balances.get(accounts[CODE.openingBalanceEquity])?.natural.toString()).toBe('12000')
      expect(balances.get(accounts[CODE.bank])?.natural.toString()).toBe('12000')

      // Opening balances sit before the year, so they are an opening figure in it,
      // not movement within it.
      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      const bank = report.rows.find((row) => row.code === CODE.bank)
      expect(bank?.openingDebit.toString()).toBe('12000')
      expect(bank?.periodDebit.toString()).toBe('0')
      expect(report.balanced).toBe(true)
    })
  })
})

afterAll(async () => {
  // Touching db without DATABASE_URL throws; the suite above is skipped then.
  if (process.env.DATABASE_URL) await db.$disconnect()
})
