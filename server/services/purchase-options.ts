import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { accountOptions } from '@/lib/account-options'
import { Decimal } from '@/lib/money'
import { positionsOf } from '@/server/accounting/inventory'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { selectableAccounts } from '@/server/services/account.service'
import { listForPicker as listProjects } from '@/server/services/project.service'
import {
  FORM_PICKER_BOOTSTRAP,
  FORM_PICKER_SEARCH,
  ITEM_GROUPS,
} from '@/server/services/sales-options'

const VENDOR_FORM_SELECT = {
  id: true,
  displayName: true,
  email: true,
  paymentTermId: true,
  defaultExpenseAccountId: true,
  billingLine1: true,
  billingLine2: true,
  billingCity: true,
  billingRegion: true,
  billingPostalCode: true,
  billingCountry: true,
} satisfies Prisma.VendorSelect

const CUSTOMER_OFFSET_SELECT = {
  id: true,
  displayName: true,
  email: true,
} satisfies Prisma.CustomerSelect

const ITEM_PURCHASE_SELECT = {
  id: true,
  name: true,
  sku: true,
  purchaseCost: true,
  type: true,
  unitOfMeasure: true,
  purchaseDescription: true,
  description: true,
  purchaseTaxCodeId: true,
  expenseAccountId: true,
} satisfies Prisma.ItemSelect

type VendorFormRow = Prisma.VendorGetPayload<{ select: typeof VENDOR_FORM_SELECT }>
type CustomerOffsetRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_OFFSET_SELECT }>
type ItemPurchaseRow = Prisma.ItemGetPayload<{ select: typeof ITEM_PURCHASE_SELECT }>

function mailingAddress(vendor: VendorFormRow) {
  const place = [vendor.billingCity, vendor.billingRegion, vendor.billingPostalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  return [vendor.billingLine1, vendor.billingLine2, place, vendor.billingCountry]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Everything the bill form needs, in one round trip.
 * Vendors/items/customers are capped; pickers search the rest while typing.
 */
export async function loadPurchaseOptions(
  ctx: OrgContext,
  options: {
    ensureVendorIds?: string[]
    ensureCustomerIds?: string[]
    ensureItemIds?: string[]
  } = {},
) {
  const base = await cachedPurchaseOptions(
    ctx.orgId,
    ctx.features.enableTax,
    ctx.permissions.has('project:read'),
  )

  const ensureVendorIds = uniqueIds(options.ensureVendorIds).filter(
    (id) => !base.vendors.some((row) => row.id === id),
  )
  const ensureCustomerIds = uniqueIds(options.ensureCustomerIds).filter(
    (id) => !base.customers.some((row) => row.id === id),
  )
  const ensureItemIds = uniqueIds(options.ensureItemIds).filter(
    (id) => !base.items.some((row) => row.id === id),
  )
  if (
    ensureVendorIds.length === 0 &&
    ensureCustomerIds.length === 0 &&
    ensureItemIds.length === 0
  ) {
    return base
  }

  const [extraVendors, extraCustomers, extraItems] = await Promise.all([
    ensureVendorIds.length
      ? db.vendor.findMany({
          where: { orgId: ctx.orgId, id: { in: ensureVendorIds } },
          select: VENDOR_FORM_SELECT,
        })
      : Promise.resolve([] as VendorFormRow[]),
    ensureCustomerIds.length
      ? db.customer.findMany({
          where: { orgId: ctx.orgId, id: { in: ensureCustomerIds } },
          select: CUSTOMER_OFFSET_SELECT,
        })
      : Promise.resolve([] as CustomerOffsetRow[]),
    ensureItemIds.length
      ? db.item.findMany({
          where: { orgId: ctx.orgId, id: { in: ensureItemIds } },
          select: ITEM_PURCHASE_SELECT,
        })
      : Promise.resolve([] as ItemPurchaseRow[]),
  ])

  const trackedIds = extraItems.filter((item) => item.type === 'INVENTORY').map((item) => item.id)
  const positions = trackedIds.length
    ? await positionsOf(db as unknown as Tx, ctx.orgId, trackedIds)
    : new Map()

  return {
    ...base,
    vendors: [...base.vendors, ...extraVendors.map(presentVendor)],
    customers: [...base.customers, ...extraCustomers.map(presentCustomerOffset)],
    items: [
      ...base.items,
      ...extraItems.map((item) => presentPurchaseItem(item, ctx.features.enableTax, positions)),
    ],
  }
}

const cachedPurchaseOptions = cache(
  (orgId: string, enableTax: boolean, canReadProjects: boolean) =>
    unstable_cache(
      () => queryPurchaseOptions(orgId, enableTax, canReadProjects),
      ['purchase-form-options-v3', orgId, String(enableTax), String(canReadProjects)],
      { revalidate: 60 },
    )(),
)

async function queryPurchaseOptions(
  orgId: string,
  enableTax: boolean,
  canReadProjects: boolean,
) {
  const ctx = {
    orgId,
    permissions: new Set(canReadProjects ? ['project:read'] : []),
    features: { enableTax },
  } as unknown as OrgContext

  const [vendors, customers, items, taxCodes, chart, terms, projects] = await Promise.all([
    db.vendor.findMany({
      where: { orgId, isActive: true },
      select: VENDOR_FORM_SELECT,
      orderBy: { displayName: 'asc' },
      take: FORM_PICKER_BOOTSTRAP,
    }),
    db.customer.findMany({
      where: { orgId, isActive: true },
      select: CUSTOMER_OFFSET_SELECT,
      orderBy: { displayName: 'asc' },
      take: FORM_PICKER_BOOTSTRAP,
    }),
    db.item.findMany({
      where: { orgId, isActive: true },
      select: ITEM_PURCHASE_SELECT,
      orderBy: { name: 'asc' },
      take: FORM_PICKER_BOOTSTRAP,
    }),
    db.taxCode.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true, name: true, isInclusive: true,
        components: { select: { taxRate: { select: { rate: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    selectableAccounts(ctx, { withBalances: false }),
    db.paymentTerm.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true, type: true, dueDays: true },
      orderBy: [{ isDefault: 'desc' }, { dueDays: 'asc' }],
    }),
    listProjects(ctx),
  ])

  const trackedIds = items.filter((item) => item.type === 'INVENTORY').map((item) => item.id)
  const positions = await positionsOf(db as unknown as Tx, orgId, trackedIds)

  return {
    vendors: vendors.map(presentVendor),
    customers: customers.map(presentCustomerOffset),
    items: items.map((item) => presentPurchaseItem(item, enableTax, positions)),
    taxCodes: enableTax
      ? taxCodes.map((code) => ({
          id: code.id,
          label: code.name,
          isInclusive: code.isInclusive,
          rate: code.components.reduce((total, c) => total + Number(c.taxRate.rate), 0),
        }))
      : [],
    paymentAccounts: accountOptions(chart, {
      prefer: ['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'],
      showBalance: false,
    }),
    expenseAccounts: accountOptions(chart, {
      prefer: ['OPERATING_EXPENSE', 'OTHER_EXPENSE', 'DEPRECIATION'],
      preferTypes: ['EXPENSE'],
    }),
    terms,
    projects,
  }
}

export async function searchPurchaseVendors(ctx: OrgContext, q: string) {
  const needle = q.trim()
  if (!needle) return []
  const rows = await db.vendor.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      OR: [
        { displayName: { contains: needle, mode: 'insensitive' } },
        { companyName: { contains: needle, mode: 'insensitive' } },
        { email: { contains: needle, mode: 'insensitive' } },
        { phone: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: VENDOR_FORM_SELECT,
    orderBy: { displayName: 'asc' },
    take: FORM_PICKER_SEARCH,
  })
  return rows.map(presentVendor)
}

export async function searchPurchaseCustomers(ctx: OrgContext, q: string) {
  const needle = q.trim()
  if (!needle) return []
  const rows = await db.customer.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      OR: [
        { displayName: { contains: needle, mode: 'insensitive' } },
        { companyName: { contains: needle, mode: 'insensitive' } },
        { email: { contains: needle, mode: 'insensitive' } },
        { phone: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: CUSTOMER_OFFSET_SELECT,
    orderBy: { displayName: 'asc' },
    take: FORM_PICKER_SEARCH,
  })
  return rows.map(presentCustomerOffset)
}

export async function searchPurchaseItems(ctx: OrgContext, q: string) {
  const needle = q.trim()
  if (!needle) return []
  const rows = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      OR: [
        { name: { contains: needle, mode: 'insensitive' } },
        { sku: { contains: needle, mode: 'insensitive' } },
        { barcode: { contains: needle, mode: 'insensitive' } },
        { purchaseDescription: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: ITEM_PURCHASE_SELECT,
    orderBy: { name: 'asc' },
    take: FORM_PICKER_SEARCH,
  })
  const trackedIds = rows.filter((item) => item.type === 'INVENTORY').map((item) => item.id)
  const positions = trackedIds.length
    ? await positionsOf(db as unknown as Tx, ctx.orgId, trackedIds)
    : new Map()
  return rows.map((item) => presentPurchaseItem(item, ctx.features.enableTax, positions))
}

function presentVendor(vendor: VendorFormRow) {
  return {
    id: vendor.id,
    label: vendor.displayName,
    email: vendor.email,
    paymentTermId: vendor.paymentTermId,
    mailingAddress: mailingAddress(vendor),
    defaultExpenseAccountId: vendor.defaultExpenseAccountId,
  }
}

function presentCustomerOffset(customer: CustomerOffsetRow) {
  return {
    id: customer.id,
    label: customer.displayName,
    email: customer.email,
  }
}

function presentPurchaseItem(
  item: ItemPurchaseRow,
  enableTax: boolean,
  positions: Map<string, { quantity: Decimal }>,
) {
  return {
    id: item.id,
    label: item.sku ? `${item.sku} — ${item.name}` : item.name,
    unitOfMeasure: item.unitOfMeasure,
    price: item.purchaseCost?.toString() ?? null,
    description: item.purchaseDescription ?? item.description ?? item.name,
    taxCodeId: enableTax ? item.purchaseTaxCodeId : null,
    expenseAccountId: item.expenseAccountId,
    type: item.type,
    group: ITEM_GROUPS[item.type],
    onHand:
      item.type === 'INVENTORY'
        ? (positions.get(item.id)?.quantity ?? new Decimal(0)).toFixed(2)
        : null,
  }
}

function uniqueIds(ids: string[] | undefined) {
  return [...new Set((ids ?? []).filter(Boolean))]
}
