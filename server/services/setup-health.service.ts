import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { localizationPackById } from '@/lib/localization/packs'
import { parseFeatureFlags } from '@/lib/feature-flags'
import { getPack } from '@/lib/packs'
import {
  SETUP_HEALTH_GAP_HEADERS,
  categorizeHealItemName,
  type SetupHealthGapRow,
} from '@/lib/setup-heal'
import { skuFromName } from '@/lib/sku'
import { toCsv, type CsvCell } from '@/server/reports/csv'
import {
  renderMultiSheetXlsx,
  type ListXlsxColumn,
  type ListXlsxSheet,
  xlsxResponse,
} from '@/server/reports/list-xlsx'

export type SetupHealth = {
  installedPackId: string | null
  installedPackLabel: string | null
  localizationPackId: string | null
  country: string | null
  localizationReady: boolean
  enableTax: boolean
  modulesOn: number
  modulesGranted: number
  itemsTotal: number
  itemsMissingSku: number
  stockMissingReorder: number
  itemsMissingTax: number
  customersTotal: number
  customersMissingBillingCountry: number
  orgCountryMissing: boolean
}

/**
 * One snapshot for Settings → Setup: apps weight, localization, master-data gaps.
 * Does not change data — only reports what staff should finish.
 */
export async function loadSetupHealth(ctx: OrgContext): Promise<SetupHealth> {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: {
      installedPackId: true,
      localizationPackId: true,
      country: true,
      featureFlags: true,
    },
  })
  const flags = parseFeatureFlags(org?.featureFlags)
  const modulesOn = Object.values(flags.modules).filter(Boolean).length
  const modulesGranted = Object.values(flags.grantedModules).filter(Boolean).length

  const [
    itemsTotal,
    itemsMissingSku,
    stockMissingReorder,
    itemsMissingTax,
    customersTotal,
    customersMissingBillingCountry,
  ] = await Promise.all([
    db.item.count({ where: { orgId: ctx.orgId, deletedAt: null, isActive: true } }),
    db.item.count({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ sku: null }, { sku: '' }],
      },
    }),
    db.item.count({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
        reorderPoint: null,
      },
    }),
    db.item.count({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ salesTaxCodeId: null }, { purchaseTaxCodeId: null }],
      },
    }),
    db.customer.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.customer.count({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        OR: [{ billingCountry: null }, { billingCountry: '' }],
      },
    }),
  ])

  const pack = org?.installedPackId ? getPack(org.installedPackId) : null
  const localizationPackId = org?.localizationPackId ?? null

  return {
    installedPackId: org?.installedPackId ?? null,
    installedPackLabel: pack?.label ?? null,
    localizationPackId,
    country: org?.country ?? null,
    localizationReady: Boolean(localizationPackById(localizationPackId)),
    enableTax: flags.enableTax,
    modulesOn,
    modulesGranted,
    itemsTotal,
    itemsMissingSku,
    stockMissingReorder,
    itemsMissingTax,
    customersTotal,
    customersMissingBillingCountry,
    orgCountryMissing: !org?.country?.trim(),
  }
}

/** Remaining gaps as rows for CSV export. */
export async function listSetupHealthGaps(ctx: OrgContext): Promise<SetupHealthGapRow[]> {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { name: true, country: true },
  })
  const [missingSku, missingReorder, missingTax, missingCountry] = await Promise.all([
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ sku: null }, { sku: '' }],
      },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
        reorderPoint: null,
      },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ salesTaxCodeId: null }, { purchaseTaxCodeId: null }],
      },
      select: { id: true, name: true, sku: true, salesTaxCodeId: true, purchaseTaxCodeId: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.customer.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        OR: [{ billingCountry: null }, { billingCountry: '' }],
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 5000,
    }),
  ])

  const gaps: SetupHealthGapRow[] = []
  if (!org?.country?.trim()) {
    gaps.push({
      kind: 'org_missing_country',
      name: org?.name ?? 'Organisation',
      detail: 'Set country on Settings → Organisation, or heal from the localisation pack',
    })
  }
  for (const item of missingSku) {
    gaps.push({
      kind: 'item_missing_sku',
      name: item.name,
      sku: item.sku,
      id: item.id,
      detail: 'Active item has no SKU',
    })
  }
  for (const item of missingReorder) {
    gaps.push({
      kind: 'stock_missing_reorder',
      name: item.name,
      sku: item.sku,
      id: item.id,
      detail: 'Stock item has no reorder point',
    })
  }
  for (const item of missingTax) {
    const parts = [
      item.salesTaxCodeId ? null : 'sales tax',
      item.purchaseTaxCodeId ? null : 'purchase tax',
    ].filter(Boolean)
    gaps.push({
      kind: 'item_missing_tax',
      name: item.name,
      sku: item.sku,
      id: item.id,
      detail: `Missing ${parts.join(' and ')}`,
    })
  }
  for (const customer of missingCountry) {
    gaps.push({
      kind: 'customer_missing_country',
      name: customer.displayName,
      id: customer.id,
      detail: 'Active customer has no billing country',
    })
  }
  return gaps
}

export function setupHealthGapsCsv(gaps: SetupHealthGapRow[]): string {
  return toCsv([[...SETUP_HEALTH_GAP_HEADERS], ...gaps.map((row) => [
    row.kind,
    row.name,
    row.sku ?? '',
    row.id ?? '',
    row.detail,
  ])])
}

function ofKind(gaps: SetupHealthGapRow[], kind: string) {
  return gaps.filter((row) => row.kind === kind)
}

/**
 * Prepared multi-sheet heal workbook: summary, suggested SKUs / reorder / country,
 * category view, plus the raw gap list.
 */
export async function setupHealthGapsXlsx(
  ctx: OrgContext,
  gaps: SetupHealthGapRow[],
): Promise<Uint8Array> {
  const missingSku = ofKind(gaps, 'item_missing_sku')
  const missingReorder = ofKind(gaps, 'stock_missing_reorder')
  const missingTax = ofKind(gaps, 'item_missing_tax')
  const missingCountry = ofKind(gaps, 'customer_missing_country')
  const orgGap = ofKind(gaps, 'org_missing_country')
  const suggestedCountry = ctx.organization.country?.trim() || 'SO'

  const taken = new Set<string>()
  const skuPrepared = missingSku.map((item, index) => {
    const suggested = skuFromName(item.name, taken)
    taken.add(suggested.toLowerCase())
    const category = categorizeHealItemName(item.name)
    return {
      index: index + 1,
      name: item.name,
      category,
      suggested,
      id: item.id ?? '',
    }
  })

  const categoryCounts = new Map<string, number>()
  for (const row of skuPrepared) {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1)
  }

  const summaryCols: ListXlsxColumn[] = [
    { header: 'Gap / Category', width: 32 },
    { header: 'Count', width: 12, kind: 'number' },
    { header: 'How to fix', width: 56 },
  ]
  const summaryRows: CsvCell[][] = [
    ['Items missing SKU', missingSku.length, 'Setup → Generate missing SKUs, or edit Suggested SKU sheet'],
    ['Stock missing reorder point', missingReorder.length, 'Setup → Set missing reorder points (default 1)'],
    ['Items missing tax', missingTax.length, 'Setup → Apply pack tax to items'],
    ['Customers missing country', missingCountry.length, 'Setup → Customer countries from org'],
    ['Org missing country', orgGap.length, 'Setup → Country from pack'],
    ['', '', ''],
    ['Item category (from name)', '', 'Use for SKU prefixes / aisle planning'],
    ...[...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => [category, count, ''] as CsvCell[]),
  ]

  const sheets: ListXlsxSheet[] = [
    {
      name: 'Summary',
      title: 'Setup heal — summary',
      subtitle: `${gaps.length} remaining gaps`,
      columns: summaryCols,
      rows: summaryRows,
    },
    {
      name: 'Missing SKUs',
      title: 'Items missing SKU',
      subtitle: 'Suggested SKU matches the heal button; edit Your SKU if you prefer another code',
      columns: [
        { header: '#', width: 6, kind: 'number' },
        { header: 'Name', width: 40 },
        { header: 'Category', width: 20 },
        { header: 'Suggested SKU', width: 28 },
        { header: 'Id', width: 26 },
        { header: 'Your SKU (edit)', width: 18 },
        { header: 'Note', width: 28 },
      ],
      rows: skuPrepared.map(
        (row) =>
          [
            row.index,
            row.name,
            row.category,
            row.suggested,
            row.id,
            '',
            'Review then keep or edit',
          ] as CsvCell[],
      ),
    },
    {
      name: 'Missing Reorder',
      title: 'Stock missing reorder point',
      columns: [
        { header: '#', width: 6, kind: 'number' },
        { header: 'Name', width: 40 },
        { header: 'Current SKU', width: 20 },
        { header: 'Suggested Reorder', width: 16, kind: 'number' },
        { header: 'Id', width: 26 },
        { header: 'Note', width: 36 },
      ],
      rows: missingReorder.map(
        (item, index) =>
          [
            index + 1,
            item.name,
            item.sku?.trim() || '(none — fix SKU first)',
            1,
            item.id ?? '',
            'Heal sets reorderPoint = 1 when blank',
          ] as CsvCell[],
      ),
    },
    {
      name: 'Missing Tax',
      title: 'Items missing tax codes',
      columns: [
        { header: '#', width: 6, kind: 'number' },
        { header: 'Name', width: 40 },
        { header: 'Current SKU', width: 20 },
        { header: 'Detail', width: 32 },
        { header: 'Id', width: 26 },
        { header: 'Note', width: 40 },
      ],
      rows: missingTax.map(
        (item, index) =>
          [
            index + 1,
            item.name,
            item.sku?.trim() || '(none — fix SKU first)',
            item.detail,
            item.id ?? '',
            'Heal applies pack default sales + purchase tax',
          ] as CsvCell[],
      ),
    },
    {
      name: 'Customers no country',
      title: 'Customers missing billing country',
      columns: [
        { header: '#', width: 6, kind: 'number' },
        { header: 'Customer', width: 36 },
        { header: 'Id', width: 26 },
        { header: 'Suggested Country', width: 16 },
        { header: 'Note', width: 48 },
      ],
      rows: missingCountry.map(
        (item, index) =>
          [
            index + 1,
            item.name,
            item.id ?? '',
            suggestedCountry,
            'Heal copies org country; change if the customer is abroad',
          ] as CsvCell[],
      ),
    },
    {
      name: 'By Category',
      title: 'Missing SKUs by category',
      columns: [
        { header: 'Category', width: 20 },
        { header: 'Name', width: 40 },
        { header: 'Suggested SKU', width: 28 },
        { header: 'Id', width: 26 },
      ],
      rows: skuPrepared
        .slice()
        .sort(
          (a, b) =>
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
        )
        .map((row) => [row.category, row.name, row.suggested, row.id] as CsvCell[]),
    },
    {
      name: 'All gaps (raw)',
      title: 'All remaining gaps',
      columns: [
        { header: 'Kind', width: 24 },
        { header: 'Name', width: 40 },
        { header: 'SKU', width: 16 },
        { header: 'Id', width: 26 },
        { header: 'Detail', width: 40 },
      ],
      rows: gaps.map(
        (row) =>
          [row.kind, row.name, row.sku ?? '', row.id ?? '', row.detail] as CsvCell[],
      ),
    },
  ]

  return renderMultiSheetXlsx({
    org: ctx.organization,
    title: 'Setup heal report',
    subtitle: `${gaps.length} remaining gaps`,
    sheets,
  })
}

export function setupHealthXlsxResponse(body: Uint8Array): Response {
  return xlsxResponse('setup-heal-report.xlsx', body)
}
