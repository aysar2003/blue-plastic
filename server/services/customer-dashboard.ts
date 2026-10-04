import 'server-only'

import { addDays, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { byType } from '@/lib/sales-types'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { customerBands, type BandKey, type CustomerBand } from '@/lib/customer-bands'
import { subledgerBalances } from '@/server/services/contact.service'

export type { BandKey, CustomerBand }

const BAND_KEYS: BandKey[] = ['estimates', 'overdue', 'open', 'paid']

export function isBandKey(value: string | undefined): value is BandKey {
  return BAND_KEYS.includes(value as BandKey)
}

/**
 * The four figures on the customer list, read from the documents and the
 * payments. Deleted rows stay out: raw SQL does not get the client's soft-delete
 * filter, so it is written here.
 */
export async function customerMoneyBar(ctx: OrgContext, asOf: CalendarDate) {
  const [documents, payments, people] = await Promise.all([
    db.$queryRaw<
      {
        customerId: string
        type: string
        status: string
        total: string
        applied: string
        due: Date | null
        date: Date
      }[]
    >`
      SELECT d."customerId"                          AS "customerId",
             d.type::text                            AS type,
             d.status::text                          AS status,
             d.total::text                           AS total,
             COALESCE((
               SELECT SUM(amount)
                 FROM sales_applications
                WHERE "invoiceId" = d.id OR "creditDocumentId" = d.id
             ), 0)::text                             AS applied,
             d."dueDate"                             AS due,
             d.date                                  AS date
        FROM sales_documents d
       WHERE d."orgId" = ${ctx.orgId}
         AND d."deletedAt" IS NULL
         AND d.type::text IN ('INVOICE', 'ESTIMATE', 'CREDIT_MEMO')
         AND d.status::text NOT IN ('VOID', 'DECLINED')
    `,
    db.$queryRaw<{ customerId: string; status: string; amount: string; date: Date }[]>`
      SELECT "customerId" AS "customerId",
             status::text AS status,
             amount::text AS amount,
             date         AS date
        FROM customer_payments
       WHERE "orgId" = ${ctx.orgId}
         AND "deletedAt" IS NULL
         AND status::text <> 'VOID'
         AND date >= ${toDate(addDays(asOf, -30))}
         AND date <= ${toDate(asOf)}
    `,
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true },
    }),
  ])

  const ledger = await subledgerBalances(db, ctx, 'customer', people.map((person) => person.id))

  return customerBands(
    documents.map((row) => ({
      customerId: row.customerId,
      type: row.type,
      status: row.status,
      total: row.total,
      applied: row.applied,
      due: row.due ? toCalendarDate(row.due) : null,
      date: toCalendarDate(row.date),
    })),
    payments.map((row) => ({
      customerId: row.customerId,
      status: row.status,
      amount: row.amount,
      date: toCalendarDate(row.date),
    })),
    asOf,
    addDays(asOf, -30),
    [...ledger.entries()].map(([customerId, balance]) => ({ customerId, balance: balance.toString() })),
  )
}

export type CustomerActivityRow = {
  id: string
  href: string
  kind: string
  number: string
  date: string
  due: string | null
  account: string | null
  amount: string
  status: string
}

/** Every sale, payment, and opening journal for one customer, newest first. */
export async function customerActivity(ctx: OrgContext, customerId: string): Promise<CustomerActivityRow[]> {
  const [documents, payments, journals] = await Promise.all([
    db.salesDocument.findMany({
      where: { orgId: ctx.orgId, customerId },
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        dueDate: true,
        total: true,
        status: true,
        lines: {
          orderBy: { lineNumber: 'asc' },
          take: 1,
          select: { incomeAccount: { select: { name: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 80,
    }),
    db.customerPayment.findMany({
      where: { orgId: ctx.orgId, customerId },
      select: {
        id: true,
        number: true,
        date: true,
        amount: true,
        status: true,
        depositAccount: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 80,
    }),
    db.journalLine.findMany({
      where: {
        orgId: ctx.orgId,
        customerId,
        account: { subtype: 'ACCOUNTS_RECEIVABLE' },
        journal: {
          deletedAt: null,
          salesDocuments: { none: {} },
          customerPayments: { none: {} },
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

  const rows: (CustomerActivityRow & { sort: string })[] = [
    ...documents.map((document) => {
      const config = byType(document.type)
      return {
        id: document.id,
        href: `/sales/${config.slug}/${document.id}`,
        kind: config.singular,
        number: document.number,
        date: toCalendarDate(document.date),
        due: document.dueDate ? toCalendarDate(document.dueDate) : null,
        account: document.lines[0]?.incomeAccount?.name ?? null,
        amount: document.total.toString(),
        status: document.status,
        sort: `${toCalendarDate(document.date)}-${document.number}`,
      }
    }),
    ...payments.map((payment) => ({
      id: payment.id,
      href: `/payments?q=${encodeURIComponent(payment.number)}`,
      kind: 'Payment',
      number: payment.number,
      date: toCalendarDate(payment.date),
      due: null,
      account: payment.depositAccount.name,
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
      due: null,
      account: line.account.name,
      amount: new Decimal(line.debit).minus(line.credit).toString(),
      status: 'POSTED',
      sort: `${toCalendarDate(line.journalDate)}-${line.journal.journalNumber}`,
    })),
  ]

  return rows.sort((a, b) => b.sort.localeCompare(a.sort)).map(({ sort: _sort, ...row }) => row)
}
