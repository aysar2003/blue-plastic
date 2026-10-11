import { describe, expect, it } from 'vitest'

import { Decimal, ZERO } from '@/lib/money'
import { db } from '@/server/db'
import { statement } from '@/server/services/receivables.service'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('diagnose AR statement gaps', () => {
  it(
    'explains remaining statement vs ledger mismatches',
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

      const gaps: string[] = []
      for (const customer of customers) {
        const ledger = new Decimal(customer.balance)
        const result = await statement({ orgId: customer.orgId } as never, customer.id, {
          from: '2000-01-01',
          to: '2026-12-31',
        })
        const gap = result.closing.minus(ledger)
        if (gap.abs().lessThanOrEqualTo('0.005')) continue

        const invoicesWithoutJournal = await db.salesDocument.findMany({
          where: {
            orgId: customer.orgId,
            customerId: customer.id,
            type: 'INVOICE',
            status: { notIn: ['DRAFT', 'VOID', 'DECLINED'] },
            journalId: null,
          },
          select: { number: true, total: true, date: true, status: true },
        })

        const creditsWithoutJournal = await db.customerPayment.findMany({
          where: {
            orgId: customer.orgId,
            customerId: customer.id,
            status: { not: 'VOID' },
            journalId: null,
          },
          select: { number: true, amount: true, date: true },
        })

        const docVsJournal = await db.$queryRaw<
          { number: string; type: string; docTotal: string; journalAr: string | null }[]
        >`
          SELECT d.number, d.type::text AS type, d.total::text AS "docTotal",
                 (
                   SELECT SUM(l.debit - l.credit)::text
                     FROM journal_lines l
                     JOIN ledger_accounts a ON a.id = l."accountId" AND a.subtype::text = 'ACCOUNTS_RECEIVABLE'
                    WHERE l."journalId" = d."journalId"
                      AND l."customerId" = d."customerId"
                 ) AS "journalAr"
            FROM sales_documents d
           WHERE d."orgId" = ${customer.orgId}
             AND d."customerId" = ${customer.id}
             AND d.status NOT IN ('DRAFT', 'VOID', 'DECLINED')
             AND d.type IN ('INVOICE', 'CREDIT_MEMO')
             AND d."journalId" IS NOT NULL
        `

        const drifts = docVsJournal.filter((row) => {
          if (!row.journalAr) return true
          const doc = new Decimal(row.docTotal)
          const jr = new Decimal(row.journalAr)
          // Invoice: journal AR should equal +total; credit memo: journal AR should equal -total
          const expected = row.type === 'CREDIT_MEMO' ? doc.negated() : doc
          return expected.minus(jr).abs().greaterThan('0.005')
        })

        const byKind = new Map<string, Decimal>()
        for (const entry of result.entries) {
          const delta = entry.charge.minus(entry.credit)
          byKind.set(entry.kind, (byKind.get(entry.kind) ?? ZERO).plus(delta))
        }

        gaps.push(
          [
            customer.displayName,
            `ledger=${ledger} statement=${result.closing} gap=${gap}`,
            `byKind: ${[...byKind.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`,
            `doc/journal drifts: ${drifts.length}`,
            ...drifts
              .slice(0, 15)
              .map((row) => `  ${row.type} ${row.number} doc=${row.docTotal} journalAr=${row.journalAr}`),
            `invoices without journalId: ${invoicesWithoutJournal.length}`,
            ...invoicesWithoutJournal
              .slice(0, 5)
              .map((row) => `  INV ${row.number} ${row.total} ${row.status}`),
            `payments without journalId: ${creditsWithoutJournal.length}`,
          ].join('\n'),
        )
      }

      if (gaps.length) console.log('\nAR GAPS\n' + gaps.join('\n\n'))
      expect(gaps, gaps.join('\n\n')).toEqual([])
    },
    300_000,
  )
})
