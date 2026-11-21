import 'server-only'

import { isCollectionOverdue, overdueClock, partyFromContact } from '@/lib/invoice-overdue'
import {
  isOverdueSubscriptionInvoice,
  reminderBody,
  reminderSubject,
} from '@/lib/erp/subscription-dunning'
import { toCalendarDate, today, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as mailService from '@/server/services/mail.service'
import { outstandingBalances } from '@/server/services/sales.service'

export async function listOverdueSubscriptionInvoices(ctx: OrgContext) {
  assertPermission(ctx, 'invoice:read')
  const templates = await db.recurringTemplate.findMany({
    where: { orgId: ctx.orgId, type: 'INVOICE' },
    select: { id: true, name: true, lastDocumentId: true, payload: true },
  })
  const customerIds = new Set<string>()
  for (const template of templates) {
    const payload = template.payload as { customerId?: string }
    if (payload.customerId) customerIds.add(payload.customerId)
  }
  if (customerIds.size === 0) return []

  const clock = overdueClock(ctx.organization.timeZone)
  const invoices = await db.salesDocument.findMany({
    where: {
      orgId: ctx.orgId,
      type: 'INVOICE',
      deletedAt: null,
      status: { in: ['OPEN', 'PARTIAL'] },
      customerId: { in: [...customerIds] },
    },
    select: {
      id: true,
      number: true,
      date: true,
      dueDate: true,
      promisedDate: true,
      excludeFromOverdue: true,
      status: true,
      total: true,
      customerId: true,
      customer: {
        select: {
          displayName: true,
          email: true,
          balanceDate: true,
          agreementDate: true,
          balanceTime: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 200,
  })

  const balances = await outstandingBalances(
    db,
    invoices.map((invoice) => invoice.id),
  )
  const asOf = today(ctx.organization.timeZone)

  return invoices
    .map((invoice) => {
      const party = partyFromContact(invoice.customer)
      const overdue = isCollectionOverdue(
        {
          status: invoice.status,
          dueDate: invoice.dueDate,
          promisedDate: invoice.promisedDate,
          excludeFromOverdue: invoice.excludeFromOverdue,
          ...party,
        },
        asOf,
        clock,
      )
      const balance = toMoneyString(balances.get(invoice.id) ?? ZERO, 2)
      return {
        id: invoice.id,
        number: invoice.number,
        date: toCalendarDate(invoice.date),
        dueDate: invoice.dueDate ? toCalendarDate(invoice.dueDate) : null,
        status: invoice.status,
        total: invoice.total.toString(),
        balance,
        overdue,
        customerId: invoice.customerId,
        customerName: invoice.customer.displayName,
        customerEmail: invoice.customer.email,
      }
    })
    .filter((row) => isOverdueSubscriptionInvoice(row) && new Decimal(row.balance).greaterThan(0))
}

export async function sendReminder(ctx: OrgContext, invoiceId: string) {
  assertPermission(ctx, 'invoice:create')
  const rows = await listOverdueSubscriptionInvoices(ctx)
  const row = rows.find((item) => item.id === invoiceId)
  if (!row) throw notFound('Overdue subscription invoice')
  if (!row.customerEmail) {
    throw validation('This customer has no email address.')
  }
  const settings = await mailService.getOutboundSettings(ctx)
  if (!settings.configured) {
    throw precondition('Connect outgoing email in Settings → Organisation.')
  }
  await mailService.sendOrgMail(ctx, {
    to: row.customerEmail,
    subject: reminderSubject(row.number),
    text: reminderBody({
      customerName: row.customerName,
      invoiceNumber: row.number,
      amount: row.balance,
      dueDate: row.dueDate ?? row.date,
      organizationName: ctx.organization.name,
    }),
    fromName: ctx.organization.name,
  })
  return { id: row.id, sentTo: row.customerEmail }
}

export async function listUpcomingForCustomer(
  ctx: OrgContext,
  customerId: string,
  asOf?: CalendarDate,
) {
  const on = asOf ?? today(ctx.organization.timeZone)
  const templates = await db.recurringTemplate.findMany({
    where: { orgId: ctx.orgId, type: 'INVOICE', isActive: true },
    select: { id: true, name: true, nextRunOn: true, payload: true, isActive: true },
    orderBy: { nextRunOn: 'asc' },
    take: 40,
  })
  return templates
    .filter((row) => {
      const payload = row.payload as { customerId?: string; amount?: string }
      return payload.customerId === customerId
    })
    .map((row) => {
      const payload = row.payload as { amount?: string }
      return {
        id: row.id,
        name: row.name,
        nextRunOn: toCalendarDate(row.nextRunOn),
        amount: payload.amount ?? null,
        asOf: on,
      }
    })
}
