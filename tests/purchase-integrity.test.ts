import { afterAll, describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { db, type Tx } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

async function makeBill(
  tx: Tx,
  fixture: Fixture,
  options: { total?: string; status?: string; type?: string } = {},
) {
  const total = options.total ?? '1000'
  const vendor = await tx.vendor.create({
    data: { orgId: fixture.ctx.orgId, displayName: `Vendor ${Math.random().toString(36).slice(2, 8)}` },
    select: { id: true },
  })

  return tx.purchaseDocument.create({
    data: {
      orgId: fixture.ctx.orgId,
      type: (options.type ?? 'BILL') as 'BILL',
      number: `BILL-${Math.random().toString(36).slice(2, 8)}`,
      vendorId: vendor.id,
      date: new Date('2026-03-01T00:00:00Z'),
      dueDate: new Date('2026-03-31T00:00:00Z'),
      status: (options.status ?? 'OPEN') as 'OPEN',
      subtotal: total,
      taxTotal: '0',
      total,
      currencyCode: 'USD',
      lines: {
        create: [
          {
            orgId: fixture.ctx.orgId,
            lineNumber: 1,
            description: 'Supplies',
            quantity: '1',
            unitPrice: total,
            amount: total,
            taxAmount: '0',
            expenseAccount: { connect: { id: fixture.accounts[CODE.rent] } },
          },
        ],
      },
    },
    select: { id: true, number: true, vendorId: true },
  })
}

async function makeBillPayment(tx: Tx, fixture: Fixture, vendorId: string, amount: string) {
  return tx.billPayment.create({
    data: {
      orgId: fixture.ctx.orgId,
      number: `BP-${Math.random().toString(36).slice(2, 8)}`,
      vendorId,
      date: new Date('2026-03-10T00:00:00Z'),
      amount,
      paymentAccountId: fixture.accounts[CODE.bank],
      currencyCode: 'USD',
    },
    select: { id: true },
  })
}

suite('purchase applications', () => {
  it('refuses one with neither a payment nor a credit', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const bill = await makeBill(tx, fixture)

      await expect(
        tx.$executeRaw`
          INSERT INTO purchase_applications (id, "orgId", "billId", amount)
          VALUES ('pa-neither', ${fixture.ctx.orgId}, ${bill.id}, 100)
        `,
      ).rejects.toThrow(/purchase_applications_one_source|violates check|does not exist/i)
    })
  })

  it('refuses to over-pay a bill', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const bill = await makeBill(tx, fixture, { total: '1000' })
      const payment = await makeBillPayment(tx, fixture, bill.vendorId!, '5000')

      await tx.purchaseApplication.create({
        data: { orgId: fixture.ctx.orgId, paymentId: payment.id, billId: bill.id, amount: '1000' },
      })

      const second = await makeBillPayment(tx, fixture, bill.vendorId!, '500')
      await expect(
        tx.purchaseApplication.create({
          data: { orgId: fixture.ctx.orgId, paymentId: second.id, billId: bill.id, amount: '1' },
        }),
      ).rejects.toThrow(/already has|would settle/i)
    })
  })

  it('refuses to apply more of a payment than it is worth', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const bill = await makeBill(tx, fixture, { total: '5000' })
      const payment = await makeBillPayment(tx, fixture, bill.vendorId!, '100')

      await expect(
        tx.purchaseApplication.create({
          data: { orgId: fixture.ctx.orgId, paymentId: payment.id, billId: bill.id, amount: '200' },
        }),
      ).rejects.toThrow(/is worth|cannot come out of it/i)
    })
  })

  it('refuses to settle a purchase order', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const order = await makeBill(tx, fixture, { type: 'PURCHASE_ORDER' })
      const payment = await makeBillPayment(tx, fixture, order.vendorId!, '100')

      await expect(
        tx.purchaseApplication.create({
          data: { orgId: fixture.ctx.orgId, paymentId: payment.id, billId: order.id, amount: '100' },
        }),
      ).rejects.toThrow(/only a bill can be settled/i)
    })
  })

  it('allows a partial payment, then the rest', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const bill = await makeBill(tx, fixture, { total: '1000' })
      const first = await makeBillPayment(tx, fixture, bill.vendorId!, '400')
      const second = await makeBillPayment(tx, fixture, bill.vendorId!, '600')

      await tx.purchaseApplication.create({
        data: { orgId: fixture.ctx.orgId, paymentId: first.id, billId: bill.id, amount: '400' },
      })
      await tx.purchaseApplication.create({
        data: { orgId: fixture.ctx.orgId, paymentId: second.id, billId: bill.id, amount: '600' },
      })

      const applied = await tx.purchaseApplication.aggregate({
        where: { billId: bill.id },
        _sum: { amount: true },
      })
      expect(new Decimal(applied._sum.amount!.toString()).toString()).toBe('1000')
    })
  })
})

suite('purchase documents add up', () => {
  it('refuses a posted bill whose total disagrees with its lines', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const bill = await makeBill(tx, fixture, { total: '1000' })

      await tx.$executeRaw`UPDATE purchase_documents SET total = 9999, subtotal = 9999 WHERE id = ${bill.id}`

      await expect(tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')).rejects.toThrow(
        /subtotal of .* but its lines total/i,
      )
    })
  })

  it('refuses a negative total — that would be a vendor credit', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Negative Supplies' },
        select: { id: true },
      })

      await expect(
        tx.purchaseDocument.create({
          data: {
            orgId: fixture.ctx.orgId,
            type: 'BILL',
            number: 'BILL-NEG',
            vendorId: vendor.id,
            date: new Date('2026-03-01T00:00:00Z'),
            subtotal: '-100',
            total: '-100',
            currencyCode: 'USD',
          },
        }),
      ).rejects.toThrow(/purchase_documents_non_negative|violates check/i)
    })
  })

  it('refuses a posted expense that does not say what it was paid from', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const vendor = await tx.vendor.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Cash Supplier' },
        select: { id: true },
      })

      await expect(
        tx.purchaseDocument.create({
          data: {
            orgId: fixture.ctx.orgId,
            type: 'EXPENSE',
            number: 'EXP-1',
            vendorId: vendor.id,
            date: new Date('2026-03-01T00:00:00Z'),
            status: 'OPEN',
            subtotal: '100',
            total: '100',
            currencyCode: 'USD',
          },
        }),
      ).rejects.toThrow(/purchase_documents_payment_required|violates check/i)
    })
  })
})

suite('purchase tenancy', () => {
  it('refuses an application against another organisation\'s bill', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await makeOrg(tx)
      const b = await makeOrg(tx)

      const foreignBill = await makeBill(tx, b)
      const vendorA = await tx.vendor.create({
        data: { orgId: a.ctx.orgId, displayName: 'Ours Ltd' },
        select: { id: true },
      })
      const payment = await makeBillPayment(tx, a, vendorA.id, '100')

      await expect(
        tx.purchaseApplication.create({
          data: { orgId: a.ctx.orgId, paymentId: payment.id, billId: foreignBill.id, amount: '100' },
        }),
      ).rejects.toThrow(/purchase_applications_bill_org_fkey|foreign key/i)
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})
