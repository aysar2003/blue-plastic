import { afterAll, describe, expect, it } from 'vitest'

import { balancesAsOf, generalLedger, generalLedgerBook, trialBalance } from '@/server/accounting/balances'
import { db } from '@/server/db'

/**
 * The report queries are hand-written SQL, so they are the one part of the
 * ledger that TypeScript cannot vouch for. These run them against the live
 * database — read-only, no writes, no transaction — purely to prove the SQL is
 * valid and returns the shape the callers expect.
 */
const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('report SQL executes against the real database', () => {
  it('runs the trial balance and returns a balanced, well-formed result', async () => {
    const org = await db.organization.findFirst({ select: { id: true } })
    if (!org) return

    const report = await trialBalance(org.id, { from: '2000-01-01', to: '2100-12-31' })

    expect(Array.isArray(report.rows)).toBe(true)
    expect(report.totalDebit.toString()).toBe(report.totalCredit.toString())
    expect(report.balanced).toBe(true)

    for (const row of report.rows) {
      expect(typeof row.code).toBe('string')
      // A row is on one side or the other, never both.
      expect(row.closingDebit.isZero() || row.closingCredit.isZero()).toBe(true)
    }
  })

  it('runs balancesAsOf and keys by account', async () => {
    const org = await db.organization.findFirst({ select: { id: true } })
    if (!org) return

    const balances = await balancesAsOf(org.id, '2100-12-31')
    expect(balances instanceof Map).toBe(true)

    const accountCount = await db.ledgerAccount.count({ where: { orgId: org.id } })
    expect(balances.size).toBe(accountCount)
  })

  it('runs the general ledger, including its contra-account subquery', async () => {
    const org = await db.organization.findFirst({ select: { id: true } })
    if (!org) return

    const account = await db.ledgerAccount.findFirst({
      where: { orgId: org.id },
      select: { id: true },
    })
    if (!account) return

    const ledger = await generalLedger(org.id, account.id, { from: '2000-01-01', to: '2100-12-31' })

    expect(Array.isArray(ledger.entries)).toBe(true)
    expect(ledger.opening).toBeDefined()
    expect(ledger.closing).toBeDefined()

    // The running balance must end where the closing balance says it does.
    if (ledger.entries.length > 0) {
      expect(ledger.entries[ledger.entries.length - 1].balance.toString()).toBe(
        ledger.closing.toString(),
      )
    }
  })

  it('builds every account ledger in one pass and matches the account register', async () => {
    const org = await db.organization.findFirst({ select: { id: true } })
    if (!org) return

    const range = { from: '2026-01-01' as const, to: '2026-11-13' as const }
    const started = Date.now()
    const book = await generalLedgerBook(org.id, range)
    const elapsed = Date.now() - started

    expect(Array.isArray(book)).toBe(true)
    // Two queries, not one round trip per account. A minute here means the N+1 is back.
    expect(elapsed).toBeLessThan(20_000)

    const sample = book.filter((section) => section.entries.length > 0).slice(0, 3)
    for (const section of sample) {
      const ledger = await generalLedger(org.id, section.id, range, { limit: 500 })
      expect(ledger.opening.toString()).toBe(section.opening.toString())
      expect(ledger.closing.toString()).toBe(section.closing.toString())
      expect(ledger.entries.map((entry) => entry.lineId)).toEqual(section.entries.map((entry) => entry.lineId))
      if (ledger.entries.length > 0) {
        expect(ledger.entries[0].balance.toString()).toBe(section.entries[0].balance.toString())
        expect(ledger.entries.at(-1)?.balance.toString()).toBe(section.entries.at(-1)?.balance.toString())
      }
    }
  }, 60_000)

  it('returns an empty result rather than throwing for an unknown account', async () => {
    const org = await db.organization.findFirst({ select: { id: true } })
    if (!org) return

    const ledger = await generalLedger(org.id, 'does-not-exist', {
      from: '2000-01-01',
      to: '2100-12-31',
    })
    expect(ledger.entries).toEqual([])
  })
})

afterAll(async () => {
  await db.$disconnect()
})
