import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { trialBalance } from '@/server/accounting/balances'
import { db } from '@/server/db'
import { companySnapshots } from '@/server/reports/company-consolidation'
import { statement } from '@/server/services/receivables.service'
import { forwardBalances } from '@/lib/customer-statement'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('live ledger assurance', () => {
  it(
    'every company trial balance nets to zero',
    async () => {
      const orgs = await db.organization.findMany({
        select: { id: true, name: true, baseCurrency: true },
        orderBy: { name: 'asc' },
      })
      expect(orgs.length).toBeGreaterThan(0)

      for (const org of orgs) {
        const tb = await trialBalance(org.id, { from: '2000-01-01', to: '2026-10-11' })
        expect(tb.balanced, `${org.name} trial balance out by ${tb.totalDebit.minus(tb.totalCredit)}`).toBe(
          true,
        )
      }
    },
    180_000,
  )

  it(
    'customer statement closing matches AR subledger for top balances',
    async () => {
      const customers = await db.$queryRaw<
        { id: string; displayName: string; orgId: string; balance: string }[]
      >`
        SELECT c.id, c."displayName", c."orgId",
               COALESCE(SUM(l.debit - l.credit), 0)::text AS balance
          FROM customers c
          JOIN journal_lines l ON l."customerId" = c.id AND l."orgId" = c."orgId"
          JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
          JOIN ledger_accounts a ON a.id = l."accountId" AND a.subtype::text = 'ACCOUNTS_RECEIVABLE'
         WHERE c."isActive" = true
         GROUP BY c.id, c."displayName", c."orgId"
        HAVING ABS(COALESCE(SUM(l.debit - l.credit), 0)) > 0.005
         ORDER BY ABS(COALESCE(SUM(l.debit - l.credit), 0)) DESC
         LIMIT 20
      `

      for (const customer of customers) {
        const ledger = new Decimal(customer.balance)
        const result = await statement({ orgId: customer.orgId } as never, customer.id, {
          from: '2000-01-01',
          to: '2026-12-31',
        })
        const gap = result.closing.minus(ledger).abs()
        expect(
          gap.lessThanOrEqualTo('0.005'),
          `${customer.displayName}: ledger ${ledger} vs statement ${result.closing}`,
        ).toBe(true)

        // UI running balance must match the same closing.
        const forwarded = forwardBalances(result.entries, result.opening)
        expect(forwarded.closing.toString()).toBe(result.closing.toString())
      }
    },
    180_000,
  )

  it(
    'company consolidation returns a row per organisation',
    async () => {
      const orgs = await db.organization.count()
      const snaps = await companySnapshots({ from: '2026-01-01', to: '2026-10-11' })
      expect(snaps.rows.length).toBe(orgs)
    },
    120_000,
  )
})
