import 'server-only'

import { addDays, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { isVendorBandKey, vendorBands, type VendorBand, type VendorBandKey } from '@/lib/vendor-bands'
import { subledgerBalances } from '@/server/services/contact.service'

export type { VendorBand, VendorBandKey }
export { isVendorBandKey }

/**
 * The four figures on the vendor list, from bills, purchase orders, and
 * recent bill payments.
 */
export async function vendorMoneyBar(ctx: OrgContext, asOf: CalendarDate) {
  const [documents, payments, people] = await Promise.all([
    db.$queryRaw<
      {
        vendorId: string
        type: string
        status: string
        total: string
        applied: string
        due: Date | null
        date: Date
      }[]
    >`
      SELECT d."vendorId"                            AS "vendorId",
             d.type::text                            AS type,
             d.status::text                          AS status,
             d.total::text                           AS total,
             COALESCE((
               SELECT SUM(amount)
                 FROM purchase_applications
                WHERE "billId" = d.id OR "creditDocumentId" = d.id
             ), 0)::text                             AS applied,
             d."dueDate"                             AS due,
             d.date                                  AS date
        FROM purchase_documents d
       WHERE d."orgId" = ${ctx.orgId}
         AND d."deletedAt" IS NULL
         AND d.type::text IN ('BILL', 'VENDOR_CREDIT', 'PURCHASE_ORDER')
         AND d.status::text NOT IN ('VOID')
    `,
    db.$queryRaw<{ vendorId: string; status: string; amount: string; date: Date }[]>`
      SELECT "vendorId" AS "vendorId",
             status::text AS status,
             amount::text AS amount,
             date         AS date
        FROM bill_payments
       WHERE "orgId" = ${ctx.orgId}
         AND "deletedAt" IS NULL
         AND status::text <> 'VOID'
         AND date >= ${toDate(addDays(asOf, -30))}
         AND date <= ${toDate(asOf)}
    `,
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true },
    }),
  ])

  const ledger = await subledgerBalances(db, ctx, 'vendor', people.map((person) => person.id))

  return vendorBands(
    documents.map((row) => ({
      vendorId: row.vendorId,
      type: row.type,
      status: row.status,
      total: row.total,
      applied: row.applied,
      due: row.due ? toCalendarDate(row.due) : null,
      date: toCalendarDate(row.date),
    })),
    payments.map((row) => ({
      vendorId: row.vendorId,
      status: row.status,
      amount: row.amount,
      date: toCalendarDate(row.date),
    })),
    asOf,
    addDays(asOf, -30),
    [...ledger.entries()].map(([vendorId, balance]) => ({ vendorId, balance: balance.toString() })),
  )
}
