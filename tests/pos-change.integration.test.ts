import { afterAll, describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { accountTenderTotals } from '@/lib/pos-change'
import { buildSalesReceiptJournal } from '@/server/accounting/builders/sales'
import { priceDocument } from '@/server/accounting/sales-pricing'
import { postJournal } from '@/server/accounting/posting'
import { db } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('POS change hits the ledger and stays readable on older sales', () => {
  it('posts cash +100, wallet −13, and income 87, and an older sale without a change account still nets', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)
      const evc = await tx.ledgerAccount.create({
        data: {
          orgId: ctx.orgId,
          code: '1025',
          name: 'EVC 88',
          type: 'ASSET',
          subtype: 'OTHER_CURRENT_ASSET',
        },
        select: { id: true },
      })

      const sale = priceDocument(
        [{ quantity: '1', unitPrice: '87', incomeAccountId: accounts[CODE.sales] }],
        new Map(),
        'USD',
      )
      const journal = buildSalesReceiptJournal({
        date: '2026-10-09',
        number: 'SR-87',
        documentId: 'doc-change',
        customerId: 'cust-1',
        priced: sale,
        receivableAccountId: accounts[CODE.receivable],
        depositAccountId: accounts[CODE.cash],
        fallbackIncomeAccountId: accounts[CODE.sales],
        paymentSplits: [
          { accountId: accounts[CODE.cash], amount: new Decimal('100'), description: 'Cash' },
        ],
        changeReturns: [{ accountId: evc.id, amount: new Decimal('13'), description: 'Change · EVC 88' }],
      })

      const posted = await postJournal(tx, ctx, journal)
      const lines = await tx.journalLine.findMany({
        where: { journalId: posted.id },
        select: { accountId: true, debit: true, credit: true },
      })

      const net = (accountId: string) =>
        lines
          .filter((line) => line.accountId === accountId)
          .reduce(
            (sum, line) => sum.plus(line.debit.toString()).minus(line.credit.toString()),
            new Decimal(0),
          )

      expect(net(accounts[CODE.cash]).toString()).toBe('100')
      expect(net(evc.id).toString()).toBe('-13')
      expect(net(accounts[CODE.sales]).toString()).toBe('-87')

      const customer = await tx.customer.create({
        data: { orgId: ctx.orgId, displayName: 'Walk in' },
        select: { id: true },
      })
      const cashMethod = await tx.posPaymentMethod.create({
        data: {
          orgId: ctx.orgId,
          name: 'Cash',
          ledgerAccountId: accounts[CODE.cash],
          allowsChangeReturn: true,
        },
        select: { id: true },
      })
      const evcMethod = await tx.posPaymentMethod.create({
        data: {
          orgId: ctx.orgId,
          name: 'EVC 88',
          ledgerAccountId: evc.id,
          allowsChangeReturn: true,
        },
        select: { id: true },
      })
      const register = await tx.posRegister.create({
        data: {
          orgId: ctx.orgId,
          name: 'Till',
          defaultCustomerId: customer.id,
          defaultChangeMethodId: cashMethod.id,
          allowWalletChangeReturn: true,
          methods: {
            create: [
              { paymentMethodId: cashMethod.id, allowsChangeReturn: true },
              { paymentMethodId: evcMethod.id, allowsChangeReturn: true },
            ],
          },
        },
        select: { id: true, defaultChangeMethodId: true, allowWalletChangeReturn: true },
      })
      expect(register.defaultChangeMethodId).toBe(cashMethod.id)
      expect(register.allowWalletChangeReturn).toBe(true)

      async function receipt(number: string, total: string) {
        return tx.salesDocument.create({
          data: {
            orgId: ctx.orgId,
            type: 'SALES_RECEIPT',
            number,
            customerId: customer.id,
            date: new Date('2026-10-09T00:00:00Z'),
            status: 'PAID',
            subtotal: total,
            taxTotal: '0',
            total,
            currencyCode: 'USD',
            depositAccountId: accounts[CODE.cash],
            lines: {
              create: [
                {
                  orgId: ctx.orgId,
                  lineNumber: 1,
                  description: 'Goods',
                  quantity: '1',
                  unitPrice: total,
                  amount: total,
                  taxAmount: '0',
                  incomeAccountId: accounts[CODE.sales],
                },
              ],
            },
          },
          select: { id: true },
        })
      }

      const withChange = await receipt('SR-NEW', '87')
      const legacy = await receipt('SR-OLD', '40')

      await tx.posOrder.create({
        data: {
          orgId: ctx.orgId,
          registerId: register.id,
          salesDocumentId: withChange.id,
          changeAmount: '13',
          changePaymentMethodId: evcMethod.id,
          changeLedgerAccountId: evc.id,
          payments: {
            create: [
              {
                paymentMethodId: cashMethod.id,
                ledgerAccountId: accounts[CODE.cash],
                amount: '100',
              },
            ],
          },
        },
      })
      // A sale from before change was recorded: payment equals the total, change stays null.
      await tx.posOrder.create({
        data: {
          orgId: ctx.orgId,
          registerId: register.id,
          salesDocumentId: legacy.id,
          payments: {
            create: [
              {
                paymentMethodId: cashMethod.id,
                ledgerAccountId: accounts[CODE.cash],
                amount: '40',
              },
            ],
          },
        },
      })

      const stored = await tx.posOrder.findMany({
        where: { orgId: ctx.orgId },
        select: {
          changeAmount: true,
          changePaymentMethodId: true,
          changeLedgerAccountId: true,
          changePaymentMethod: { select: { name: true } },
          payments: {
            select: {
              amount: true,
              ledgerAccountId: true,
              paymentMethod: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { changeAmount: 'asc' },
      })

      expect(stored[0]?.changePaymentMethodId).toBeNull()
      expect(stored[0]?.changeAmount.toString()).toBe('0')
      const totals = accountTenderTotals(
        stored.map((order) => ({
          payments: order.payments.map((payment) => ({
            methodId: payment.paymentMethod.id,
            methodName: payment.paymentMethod.name,
            accountId: payment.ledgerAccountId,
            amount: payment.amount.toString(),
          })),
          changeAmount: order.changeAmount.toString(),
          changeMethodId: order.changePaymentMethodId,
          changeMethodName: order.changePaymentMethod?.name ?? null,
          changeAccountId: order.changeLedgerAccountId,
        })),
      )
      const cash = totals.find((row) => row.accountId === accounts[CODE.cash])
      const wallet = totals.find((row) => row.accountId === evc.id)
      expect(cash).toMatchObject({ tendered: '140.00', change: '0.00', net: '140.00' })
      expect(wallet).toMatchObject({ tendered: '0.00', change: '13.00', net: '-13.00' })
    })
  })
})

afterAll(async () => {
  if (process.env.DATABASE_URL) await db.$disconnect()
})
