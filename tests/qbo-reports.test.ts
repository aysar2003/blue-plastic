import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { describe, expect, it } from 'vitest'

import { toDate } from '@/lib/date'
import { permissionsFor } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { tableReport } from '@/server/reports/catalogue'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'
import type { Tx } from '@/server/db'

const suite = process.env.DATABASE_URL ? describe : describe.skip

const RANGE = { from: '2026-01-01', to: '2026-12-31' } as const
const AS_OF = '2026-10-01' as const

async function invoice(
  tx: Tx,
  fixture: Fixture,
  customerId: string,
  input: { number: string; date: string; due: string; status: 'OPEN' | 'DRAFT' | 'VOID'; total: string },
) {
  await tx.salesDocument.create({
    data: {
      orgId: fixture.ctx.orgId,
      type: 'INVOICE',
      number: input.number,
      customerId,
      date: toDate(input.date),
      dueDate: toDate(input.due),
      status: input.status,
      subtotal: input.total,
      total: input.total,
      currencyCode: 'USD',
      lines: {
        create: [
          {
            orgId: fixture.ctx.orgId,
            lineNumber: 1,
            quantity: '1',
            unitPrice: input.total,
            amount: input.total,
          },
        ],
      },
    },
  })
}

suite('QuickBooks-style lists follow the documents', () => {
  it('lists every invoice, and collections only those past due with a balance', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const customer = await tx.customer.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Hodan Trading', phone: '610000000' },
        select: { id: true },
      })
      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Port Supplier' },
        select: { id: true },
      })

      await invoice(tx, fixture, customer.id, {
        number: 'INV-1', date: '2026-01-01', due: '2026-01-15', status: 'OPEN', total: '100',
      })
      await invoice(tx, fixture, customer.id, {
        number: 'INV-D', date: '2026-02-01', due: '2026-02-15', status: 'DRAFT', total: '10',
      })
      await invoice(tx, fixture, customer.id, {
        number: 'INV-V', date: '2026-03-01', due: '2026-03-15', status: 'VOID', total: '5',
      })
      await invoice(tx, fixture, customer.id, {
        number: 'INV-2', date: '2026-09-01', due: '2026-12-01', status: 'OPEN', total: '40',
      })

      await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'BILL',
          number: 'BILL-1',
          vendorId: vendor.id,
          date: toDate('2026-02-01'),
          dueDate: toDate('2026-02-15'),
          status: 'OPEN',
          subtotal: '80',
          total: '80',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                amount: '80',
                expenseAccountId: fixture.accounts[CODE.utilities],
              },
            ],
          },
        },
      })

      const input = { ctx: fixture.ctx, range: RANGE, asOf: AS_OF, client: tx }

      const listed = await tableReport('invoice-list')!.build(input)
      expect(listed.rows.map((row) => row.cells.number)).toEqual(['INV-1', 'INV-D', 'INV-V', 'INV-2'])
      expect(listed.rows.map((row) => row.cells.balance)).toEqual(['100.00', '0.00', '0.00', '40.00'])
      expect(listed.totals?.balance).toBe('140.00')

      const collections = await tableReport('collections')!.build(input)
      expect(collections.rows.map((row) => row.cells.number)).toEqual(['INV-1'])
      expect(collections.rows[0]?.cells.phone).toBe('610000000')
      expect(collections.rows[0]?.cells.balance).toBe('100.00')
      expect(collections.totals?.balance).toBe('100.00')

      const bills = await tableReport('bill-list')!.build(input)
      expect(bills.rows.map((row) => row.cells.number)).toEqual(['BILL-1'])
      expect(bills.rows[0]?.cells.vendor).toBe('Port Supplier')
      expect(bills.totals?.balance).toBe('80.00')
    })
  })

  it('runs the standard lists against the live database', async () => {
    const organization = await db.organization.findFirst({
      select: {
        id: true, name: true, legalName: true, baseCurrency: true, fiscalYearStartMonth: true,
        timeZone: true, allowNegativeStock: true,
        addressLine1: true, addressLine2: true, city: true, region: true,
        postalCode: true, country: true, phone: true, email: true,
      },
    })
    const user = await db.user.findFirst({ select: { id: true, name: true, email: true, image: true } })
    if (!organization || !user) return

    const ctx: OrgContext = {
      orgId: organization.id,
      userId: user.id,
      role: 'OWNER',
      permissions: permissionsFor('OWNER'),
      features: DEFAULT_FEATURE_FLAGS,
      organization,
      user: { id: user.id, name: user.name ?? '', email: user.email, image: user.image },
    }

    for (const key of [
      'invoice-list',
      'collections',
      'bill-list',
      'customer-balances',
      'open-invoices',
      'vendor-balances',
      'unpaid-bills',
      'general-ledger',
      'journal-report',
      'account-balances',
    ]) {
      const table = await tableReport(key)!.build({ ctx, range: RANGE, asOf: AS_OF })
      expect(table.columns.length).toBeGreaterThan(0)
      expect(Array.isArray(table.rows)).toBe(true)
    }
  })
})
