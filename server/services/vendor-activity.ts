import 'server-only'

import { toCalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { purchaseByType } from '@/lib/purchase-types'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export type VendorActivityRow = {
  id: string
  href: string
  kind: string
  number: string
  date: string
  account: string | null
  amount: string
  status: string
}

/** Bills, expenses, credits, payments, and journals for one vendor, newest first. */
export async function vendorActivity(ctx: OrgContext, vendorId: string): Promise<VendorActivityRow[]> {
  const [documents, payments, journals] = await Promise.all([
    db.purchaseDocument.findMany({
      where: { orgId: ctx.orgId, vendorId },
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        total: true,
        status: true,
        lines: {
          orderBy: { lineNumber: 'asc' },
          take: 1,
          select: { expenseAccount: { select: { name: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 80,
    }),
    db.billPayment.findMany({
      where: { orgId: ctx.orgId, vendorId },
      select: {
        id: true,
        number: true,
        date: true,
        amount: true,
        status: true,
        paymentAccount: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 80,
    }),
    db.journalLine.findMany({
      where: {
        orgId: ctx.orgId,
        vendorId,
        account: { subtype: 'ACCOUNTS_PAYABLE' },
        journal: {
          deletedAt: null,
          purchaseDocuments: { none: {} },
          billPayments: { none: {} },
        },
      },
      select: {
        id: true,
        debit: true,
        credit: true,
        journalDate: true,
        account: { select: { name: true } },
        journal: { select: { id: true, journalNumber: true } },
      },
      orderBy: [{ journalDate: 'desc' }, { journal: { journalNumber: 'desc' } }],
      take: 80,
    }),
  ])

  const rows: (VendorActivityRow & { sort: string })[] = [
    ...documents.map((document) => {
      const config = purchaseByType(document.type)
      return {
        id: document.id,
        href: `/purchases/${config.slug}/${document.id}`,
        kind: config.singular,
        number: document.number,
        date: toCalendarDate(document.date),
        account: document.lines[0]?.expenseAccount?.name ?? null,
        amount: document.total.toString(),
        status: document.status,
        sort: `${toCalendarDate(document.date)}-${document.number}`,
      }
    }),
    ...payments.map((payment) => ({
      id: payment.id,
      href: `/bill-payments?q=${encodeURIComponent(payment.number)}`,
      kind: 'Bill payment',
      number: payment.number,
      date: toCalendarDate(payment.date),
      account: payment.paymentAccount.name,
      amount: payment.amount.toString(),
      status: payment.status,
      sort: `${toCalendarDate(payment.date)}-${payment.number}`,
    })),
    ...journals.map((line) => ({
      id: line.id,
      href: `/journals/${line.journal.id}`,
      kind: 'Journal',
      number: line.journal.journalNumber,
      date: toCalendarDate(line.journalDate),
      account: line.account.name,
      amount: new Decimal(line.credit).minus(line.debit).toString(),
      status: 'POSTED',
      sort: `${toCalendarDate(line.journalDate)}-${line.journal.journalNumber}`,
    })),
  ]

  return rows.sort((a, b) => b.sort.localeCompare(a.sort)).map(({ sort: _sort, ...row }) => row)
}
