import 'server-only'

import { endOfMonth, startOfMonth, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import {
  depreciationForMonth,
  monthlyDepreciationAmount,
} from '@/lib/fixed-asset-depreciation'
import { Decimal, money, type Decimal as MoneyDecimal } from '@/lib/money'
import { postJournal } from '@/server/accounting/posting'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound } from '@/server/errors'

export function monthlyDepreciation(
  cost: MoneyDecimal,
  salvage: MoneyDecimal,
  usefulLifeMonths: number,
): MoneyDecimal {
  return monthlyDepreciationAmount(cost, salvage, usefulLifeMonths)
}

export async function listCategories(ctx: OrgContext) {
  assertPermission(ctx, 'journal:read')
  return db.fixedAssetCategory.findMany({
    where: { orgId: ctx.orgId },
    include: {
      assetAccount: { select: { code: true, name: true } },
      accumDepAccount: { select: { code: true, name: true } },
      expenseAccount: { select: { code: true, name: true } },
      _count: { select: { assets: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function listAssets(ctx: OrgContext) {
  assertPermission(ctx, 'journal:read')
  return db.fixedAsset.findMany({
    where: { orgId: ctx.orgId },
    include: { category: { select: { name: true } } },
    orderBy: [{ status: 'asc' }, { number: 'asc' }],
  })
}

export async function createCategory(
  ctx: OrgContext,
  input: {
    name: string
    usefulLifeMonths: number
    assetAccountId: string
    accumDepAccountId: string
    expenseAccountId: string
  },
) {
  assertPermission(ctx, 'journal:post')
  return db.fixedAssetCategory.create({
    data: {
      orgId: ctx.orgId,
      name: input.name.trim(),
      usefulLifeMonths: input.usefulLifeMonths,
      assetAccountId: input.assetAccountId,
      accumDepAccountId: input.accumDepAccountId,
      expenseAccountId: input.expenseAccountId,
    },
  })
}

export async function createAsset(
  ctx: OrgContext,
  input: {
    categoryId: string
    number: string
    name: string
    acquiredOn: CalendarDate
    cost: string
    salvageValue?: string | null
    usefulLifeMonths?: number | null
  },
) {
  assertPermission(ctx, 'journal:post')
  const category = await db.fixedAssetCategory.findFirst({
    where: { id: input.categoryId, orgId: ctx.orgId },
  })
  if (!category) throw notFound('Category')

  const existing = await db.fixedAsset.findUnique({
    where: { orgId_number: { orgId: ctx.orgId, number: input.number.trim() } },
  })
  if (existing) throw conflict('That asset number is already in use.')

  return db.fixedAsset.create({
    data: {
      orgId: ctx.orgId,
      categoryId: category.id,
      number: input.number.trim(),
      name: input.name.trim(),
      acquiredOn: toDate(input.acquiredOn),
      cost: money(input.cost),
      salvageValue: money(input.salvageValue ?? '0'),
      usefulLifeMonths: input.usefulLifeMonths ?? category.usefulLifeMonths,
    },
  })
}

/** Depreciate every active asset for the calendar month containing `month`. */
export async function depreciateMonth(ctx: OrgContext, month: CalendarDate) {
  assertPermission(ctx, 'journal:post')
  const periodStart = toDate(startOfMonth(month))
  const periodEnd = toDate(endOfMonth(month))

  const assets = await db.fixedAsset.findMany({
    where: { orgId: ctx.orgId, status: 'ACTIVE' },
    include: { category: true },
  })

  let posted = 0
  for (const asset of assets) {
    if (asset.lastDepreciatedThrough && asset.lastDepreciatedThrough >= periodEnd) continue
    if (asset.acquiredOn > periodEnd) continue

    const amount = depreciationForMonth(
      asset.cost,
      asset.salvageValue,
      asset.usefulLifeMonths,
      asset.accumulatedDepreciation,
    )
    if (amount.lessThanOrEqualTo(0)) continue

    const journal = await db.$transaction(async (tx) => {
      const dup = await tx.fixedAssetDepreciation.findFirst({
        where: { assetId: asset.id, periodEnd },
      })
      if (dup) return null

      const j = await postJournal(tx, ctx, {
        date: toCalendarDate(periodEnd),
        memo: `Depreciation — ${asset.number} ${asset.name}`,
        sourceType: 'MANUAL',
        isAdjusting: true,
        lines: [
          {
            accountId: asset.category.expenseAccountId,
            debit: amount,
            description: 'Depreciation expense',
          },
          {
            accountId: asset.category.accumDepAccountId,
            credit: amount,
            description: 'Accumulated depreciation',
          },
        ],
      })

      await tx.fixedAssetDepreciation.create({
        data: {
          orgId: ctx.orgId,
          assetId: asset.id,
          periodStart,
          periodEnd,
          amount,
          journalId: j.id,
        },
      })

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: new Decimal(asset.accumulatedDepreciation.toString()).plus(amount),
          lastDepreciatedThrough: periodEnd,
        },
      })

      return j
    })

    if (journal) posted += 1
  }

  return { posted, month: toCalendarDate(periodEnd) }
}
