import 'server-only'

import { withoutBusinessOverview } from '@/lib/business-overview-access'
import { startOfMonth, today } from '@/lib/date'
import { Decimal, formatMoney } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { accountFigures, present } from '@/server/reports/framework'
import * as bankingService from '@/server/services/banking.service'

export async function listBookmarks(ctx: OrgContext) {
  const rows = await db.workspaceBookmark.findMany({
    where: { orgId: ctx.orgId, userId: ctx.userId },
    select: { id: true, label: true, href: true, kind: true },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  })
  return withoutBusinessOverview(rows, ctx.permissions)
}

export async function saveBookmark(
  ctx: OrgContext,
  input: { label: string; href: string; kind: 'shortcut' | 'pin' },
) {
  return db.workspaceBookmark.upsert({
    where: {
      orgId_userId_href_kind: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        href: input.href,
        kind: input.kind,
      },
    },
    create: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      label: input.label,
      href: input.href,
      kind: input.kind,
    },
    update: { label: input.label },
    select: { id: true },
  })
}

export async function removeBookmark(ctx: OrgContext, id: string) {
  await db.workspaceBookmark.deleteMany({ where: { id, orgId: ctx.orgId, userId: ctx.userId } })
  return { id }
}

export async function feed(ctx: OrgContext) {
  const rows = await db.auditLog.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      entity: true,
      action: true,
      at: true,
      actor: { select: { name: true } },
    },
    orderBy: { at: 'desc' },
    take: 20,
  })
  return rows.map((row) => ({
    id: row.id,
    entity: row.entity,
    action: row.action,
    at: row.at.toISOString(),
    actor: row.actor?.name ?? 'Someone',
  }))
}

export async function tasks(ctx: OrgContext) {
  const day = today(ctx.organization.timeZone)
  const [pendingBank, overdueInvoices, openBills] = await Promise.all([
    db.importedTransaction.count({ where: { orgId: ctx.orgId, status: 'PENDING' } }),
    db.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        status: { in: ['OPEN', 'PARTIAL'] },
        dueDate: { lt: new Date(`${day}T00:00:00.000Z`) },
      },
    }),
    db.purchaseDocument.count({
      where: { orgId: ctx.orgId, type: 'BILL', status: { in: ['OPEN', 'PARTIAL'] } },
    }),
  ])

  const items: { href: string; label: string }[] = []
  if (pendingBank > 0) {
    items.push({
      href: '/banking/import',
      label: `${pendingBank} bank ${pendingBank === 1 ? 'line' : 'lines'} still to post`,
    })
  }
  if (overdueInvoices > 0) {
    items.push({
      href: '/sales/invoices',
      label: `${overdueInvoices} ${overdueInvoices === 1 ? 'invoice is' : 'invoices are'} past due`,
    })
  }
  if (openBills > 0) {
    items.push({
      href: '/purchases/bills',
      label: `${openBills} ${openBills === 1 ? 'bill is' : 'bills are'} still open`,
    })
  }
  return items
}

export async function homeFigures(ctx: OrgContext) {
  const day = today(ctx.organization.timeZone)
  const from = startOfMonth(day)
  const currency = ctx.organization.baseCurrency
  const figures = await accountFigures(ctx.orgId, { from, to: day })

  let moneyIn = new Decimal(0)
  let moneyOut = new Decimal(0)
  for (const row of figures) {
    if (row.type === 'REVENUE') moneyIn = moneyIn.plus(present(row.type, row.movement))
    if (row.type === 'EXPENSE') moneyOut = moneyOut.plus(present(row.type, row.movement))
  }

  const open = await db.salesDocument.findMany({
    where: { orgId: ctx.orgId, type: 'INVOICE', status: { in: ['OPEN', 'PARTIAL'] } },
    select: { id: true },
  })
  const { outstandingBalances } = await import('@/server/services/sales.service')
  const balances = await outstandingBalances(db, open.map((row) => row.id))
  let due = new Decimal(0)
  for (const value of balances.values()) due = due.plus(value)

  const accounts = await bankingService.bankAccounts(ctx)
  const banks = accounts
    .filter((account) => account.subtype === 'BANK' || account.subtype === 'CREDIT_CARD')
    .map((account) => ({
      id: account.id,
      name: account.name,
      balance: formatMoney(account.balance, currency),
    }))

  return {
    currency,
    from,
    to: day,
    moneyIn: formatMoney(moneyIn, currency),
    moneyOut: formatMoney(moneyOut, currency),
    invoicesDue: formatMoney(due, currency),
    invoiceCount: open.length,
    banks,
  }
}

export async function readReportNote(ctx: OrgContext, reportKey: string) {
  const note = await db.reportNote.findUnique({
    where: { orgId_reportKey: { orgId: ctx.orgId, reportKey } },
    select: { body: true },
  })
  return note?.body ?? ''
}

export async function saveReportNote(ctx: OrgContext, reportKey: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed) {
    await db.reportNote.deleteMany({ where: { orgId: ctx.orgId, reportKey } })
    return { body: '' }
  }
  await db.reportNote.upsert({
    where: { orgId_reportKey: { orgId: ctx.orgId, reportKey } },
    create: { orgId: ctx.orgId, reportKey, body: trimmed },
    update: { body: trimmed },
  })
  return { body: trimmed }
}
