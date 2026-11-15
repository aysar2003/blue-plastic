import 'server-only'

import { franchiseRoyaltyAmount } from '@/lib/erp/franchise'
import { endOfMonth, startOfMonth, toCalendarDate, toDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, precondition, validation } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'

export async function listFranchiseChildren(parentCtx: OrgContext) {
  assertPermission(parentCtx, 'report:read')
  const parentId = parentCtx.organization.parentOrgId ?? parentCtx.orgId
  return db.organization.findMany({
    where: { parentOrgId: parentId },
    select: {
      id: true,
      name: true,
      franchiseRoyaltyPercent: true,
      ownershipPercent: true,
    },
    orderBy: { name: 'asc' },
  })
}

export async function setChildRoyaltyPercent(
  parentCtx: OrgContext,
  childOrgId: string,
  percent: string | null,
) {
  assertPermission(parentCtx, 'org:update')
  const parentId = parentCtx.organization.parentOrgId ?? parentCtx.orgId
  const child = await db.organization.findFirst({
    where: { id: childOrgId, parentOrgId: parentId },
    select: { id: true },
  })
  if (!child) throw notFound('Franchisee company')
  const value =
    percent == null || percent.trim() === ''
      ? null
      : new Decimal(percent).toDecimalPlaces(4)
  if (value != null && (value.lessThan(0) || value.greaterThan(100))) {
    throw validation('Royalty percent must be 0–100.')
  }
  await db.organization.update({
    where: { id: child.id },
    data: { franchiseRoyaltyPercent: value },
  })
}

/** Copy active parent items into child by SKU or name (draft-safe upsert). */
export async function catalogPush(parentCtx: OrgContext, childOrgId: string) {
  assertPermission(parentCtx, 'item:update')
  const parentId = parentCtx.orgId
  const child = await db.organization.findFirst({
    where: { id: childOrgId, parentOrgId: parentId },
    select: { id: true, name: true },
  })
  if (!child) throw notFound('Child company')

  const sourceItems = await db.item.findMany({
    where: { orgId: parentId, isActive: true, deletedAt: null },
    select: {
      sku: true,
      name: true,
      type: true,
      salesPrice: true,
      purchaseCost: true,
      incomeAccountId: true,
      expenseAccountId: true,
      inventoryAccountId: true,
      cogsAccountId: true,
      unitOfMeasure: true,
      isTaxable: true,
    },
    orderBy: { name: 'asc' },
    take: 500,
  })

  let created = 0
  let updated = 0
  for (const src of sourceItems) {
    const existing = await db.item.findFirst({
      where: {
        orgId: child.id,
        OR: [
          ...(src.sku ? [{ sku: src.sku }] : []),
          { name: { equals: src.name, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true },
    })
    const data = {
      name: src.name,
      sku: src.sku,
      type: src.type,
      salesPrice: src.salesPrice,
      purchaseCost: src.purchaseCost,
      incomeAccountId: src.incomeAccountId,
      expenseAccountId: src.expenseAccountId,
      inventoryAccountId: src.inventoryAccountId,
      cogsAccountId: src.cogsAccountId,
      unitOfMeasure: src.unitOfMeasure,
      isTaxable: src.isTaxable,
      isActive: true,
    }
    if (existing) {
      await db.item.update({ where: { id: existing.id }, data })
      updated += 1
    } else {
      await db.item.create({ data: { orgId: child.id, ...data } })
      created += 1
    }
  }
  return { childOrgId: child.id, childName: child.name, created, updated, scanned: sourceItems.length }
}

async function childSalesInMonth(childOrgId: string, asOfMonth: string) {
  const monthStart = startOfMonth(asOfMonth)
  const monthEnd = endOfMonth(asOfMonth)
  const rows = await db.salesDocument.aggregate({
    where: {
      orgId: childOrgId,
      type: 'INVOICE',
      status: { in: ['OPEN', 'PARTIAL', 'PAID'] },
      deletedAt: null,
      date: { gte: toDate(monthStart), lte: toDate(monthEnd) },
    },
    _sum: { total: true },
  })
  return new Decimal(rows._sum.total?.toString() ?? 0)
}

export async function accrueRoyalty(parentCtx: OrgContext, childOrgId: string, asOfMonth: string) {
  assertPermission(parentCtx, 'journal:post')
  const parentId = parentCtx.orgId
  const child = await db.organization.findFirst({
    where: { id: childOrgId, parentOrgId: parentId },
    select: { id: true, name: true, franchiseRoyaltyPercent: true },
  })
  if (!child) throw notFound('Child company')
  const pct = child.franchiseRoyaltyPercent
  if (pct == null) throw precondition('Set franchise royalty % on the child company first.')

  const sales = await childSalesInMonth(child.id, asOfMonth)
  const royalty = franchiseRoyaltyAmount(sales, pct)
  if (royalty.isZero()) {
    return { childOrgId: child.id, sales: sales.toFixed(4), royalty: '0.0000', journalId: null as string | null }
  }

  const { royaltyReceivableId, royaltyIncomeId } = await db.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, parentId)
    return {
      royaltyReceivableId: await systemAccountId(tx, parentId, 'ROYALTY_RECEIVABLE'),
      royaltyIncomeId: await systemAccountId(tx, parentId, 'ROYALTY_INCOME'),
    }
  })
  const memo = `[IC] Franchise royalty ${child.name} ${asOfMonth}`
  const journal = await journalService.createManual(parentCtx, {
    number: undefined,
    date: endOfMonth(asOfMonth.slice(0, 10) as import('@/lib/date').CalendarDate),
    memo,
    isAdjusting: true,
    autoReverse: false,
    lines: [
      {
        accountId: royaltyReceivableId,
        debit: royalty.toFixed(4),
        credit: '0',
        description: 'Franchise royalty receivable',
      },
      {
        accountId: royaltyIncomeId,
        debit: '0',
        credit: royalty.toFixed(4),
        description: 'Franchise royalty income',
      },
    ],
  })
  return {
    childOrgId: child.id,
    sales: sales.toFixed(4),
    royalty: royalty.toFixed(4),
    journalId: journal.id,
  }
}

export async function franchiseSummary(parentCtx: OrgContext, asOfMonth: string) {
  if (!parentCtx.permissions.has('report:read')) throw forbidden('Reports required.')
  const children = await listFranchiseChildren(parentCtx)
  const rows = []
  for (const child of children) {
    const sales = await childSalesInMonth(child.id, asOfMonth)
    const royalty = franchiseRoyaltyAmount(
      sales,
      child.franchiseRoyaltyPercent?.toString() ?? null,
    )
    rows.push({
      id: child.id,
      name: child.name,
      royaltyPercent: child.franchiseRoyaltyPercent?.toString() ?? null,
      sales: sales.toFixed(4),
      royaltyDue: royalty.toFixed(4),
    })
  }
  return { asOfMonth, children: rows }
}