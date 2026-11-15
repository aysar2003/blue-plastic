import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { accountOptions, MONEY_SUBTYPES } from '@/lib/account-options'
import { Decimal } from '@/lib/money'
import { positionsOf } from '@/server/accounting/inventory'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { selectableAccounts } from '@/server/services/account.service'
import { listForPicker as listProjects } from '@/server/services/project.service'

/** First page of the picker on form open — the rest arrives via search. */
export const FORM_PICKER_BOOTSTRAP = 100
/** Remote search page size while typing in a picker. */
export const FORM_PICKER_SEARCH = 40

const CUSTOMER_FORM_SELECT = {
  id: true,
  displayName: true,
  email: true,
  paymentTermId: true,
  currencyCode: true,
  billingLine1: true,
  billingLine2: true,
  billingCity: true,
  billingRegion: true,
  billingPostalCode: true,
  billingCountry: true,
  priceLevel: true,
  shippingLine1: true,
  shippingLine2: true,
  shippingCity: true,
  shippingRegion: true,
  shippingPostalCode: true,
  shippingCountry: true,
} satisfies Prisma.CustomerSelect

const ITEM_FORM_SELECT = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  salesPrice: true,
  wholesalePrice: true,
  type: true,
  unitOfMeasure: true,
  trackLots: true,
  trackSerials: true,
  pharmacyControlled: true,
  salesDescription: true,
  description: true,
  salesTaxCodeId: true,
  bomParents: {
    where: { parent: { type: 'GROUP' } },
    orderBy: { sortOrder: 'asc' as const },
    select: {
      quantity: true,
      component: {
        select: {
          id: true,
          name: true,
          salesPrice: true,
          wholesalePrice: true,
          salesDescription: true,
          description: true,
          salesTaxCodeId: true,
          type: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.ItemSelect

type CustomerFormRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_FORM_SELECT }>
type ItemFormRow = Prisma.ItemGetPayload<{ select: typeof ITEM_FORM_SELECT }>

/**
 * Everything the document form needs to render, in one round trip.
 *
 * Customers and items are capped for speed; typing in a picker searches the
 * rest. Pass `ensureCustomerIds` / `ensureItemIds` so edit/copy rows are always
 * present even when they fall outside the bootstrap page.
 *
 * @param options.includeOnHand — company-total qty on each inventory item. Skip
 * when the page already loads store shelves (`storeService.quantities`); that
 * duplicate scan was pushing edit/new past Vercel's 10s limit.
 */
export async function loadFormOptions(
  ctx: OrgContext,
  options: {
    includeOnHand?: boolean
    ensureCustomerIds?: string[]
    ensureItemIds?: string[]
  } = {},
) {
  const includeOnHand = options.includeOnHand !== false
  const base = await cachedFormOptions(
    ctx.orgId,
    ctx.features.enableTax,
    includeOnHand,
    ctx.permissions.has('project:read'),
  )

  const ensureCustomerIds = uniqueIds(options.ensureCustomerIds).filter(
    (id) => !base.customers.some((row) => row.id === id),
  )
  const ensureItemIds = uniqueIds(options.ensureItemIds).filter(
    (id) => !base.items.some((row) => row.id === id),
  )
  if (ensureCustomerIds.length === 0 && ensureItemIds.length === 0) return base

  const [extraCustomers, extraItems] = await Promise.all([
    ensureCustomerIds.length
      ? loadCustomersByIds(ctx.orgId, ensureCustomerIds)
      : Promise.resolve([] as CustomerFormRow[]),
    ensureItemIds.length
      ? loadItemsByIds(ctx.orgId, ensureItemIds)
      : Promise.resolve([] as ItemFormRow[]),
  ])

  const trackedIds = includeOnHand
    ? extraItems
        .filter((item) => item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY')
        .map((item) => item.id)
    : []
  const positions = includeOnHand
    ? await positionsOf(db as unknown as Tx, ctx.orgId, trackedIds)
    : new Map()

  return {
    ...base,
    customers: [
      ...base.customers,
      ...extraCustomers.map((row) => presentCustomer(row)),
    ],
    items: [
      ...base.items,
      ...extraItems.map((row) => presentItem(row, ctx.features.enableTax, includeOnHand, positions)),
    ],
  }
}

const cachedFormOptions = cache(
  (orgId: string, enableTax: boolean, includeOnHand: boolean, canReadProjects: boolean) =>
    unstable_cache(
      () => queryFormOptions(orgId, enableTax, includeOnHand, canReadProjects),
      ['sales-form-options-v5', orgId, String(enableTax), String(includeOnHand), String(canReadProjects)],
      { revalidate: 60 },
    )(),
)

async function queryFormOptions(
  orgId: string,
  enableTax: boolean,
  includeOnHand: boolean,
  canReadProjects: boolean,
) {
  const ctx = {
    orgId,
    permissions: new Set(canReadProjects ? ['project:read'] : []),
  } as unknown as OrgContext
  const [customers, items, taxCodes, chart, terms, projects] = await Promise.all([
    db.customer.findMany({
      where: { orgId, isActive: true },
      select: CUSTOMER_FORM_SELECT,
      orderBy: { displayName: 'asc' },
      take: FORM_PICKER_BOOTSTRAP,
    }),
    // Tracked stock included. BOM members only for GROUP rows.
    db.item.findMany({
      where: { orgId, isActive: true },
      select: ITEM_FORM_SELECT,
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
    // No ledger balances here — the form only needs the account list.
    selectableAccounts(ctx, { withBalances: false }),
    db.paymentTerm.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true, type: true, dueDays: true },
      orderBy: [{ isDefault: 'desc' }, { dueDays: 'asc' }],
    }),
    listProjects(ctx),
  ])

  const trackedIds = includeOnHand
    ? items
        .filter((item) => item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY')
        .map((item) => item.id)
    : []
  // Skip org-wide A/R scan — CustomerBalancePanel loads on demand.
  const positions = includeOnHand
    ? await positionsOf(db as unknown as Tx, orgId, trackedIds)
    : new Map()

  return {
    customers: customers.map((customer) => presentCustomer(customer)),
    items: items.map((item) => presentItem(item, enableTax, includeOnHand, positions)),
    taxCodes: enableTax
      ? taxCodes.map((code) => ({
          id: code.id,
          label: code.name,
          isInclusive: code.isInclusive,
          rate: code.components.reduce((total, component) => total + Number(component.taxRate.rate), 0),
        }))
      : [],
    depositAccounts: accountOptions(chart, {
      prefer: ['BANK', 'UNDEPOSITED_FUNDS', 'CREDIT_CARD', 'OTHER_CURRENT_ASSET'],
      showBalance: false,
    }),
    terms,
    projects,
  }
}

/** Remote customer hits for the sales document picker (same shape as bootstrap). */
export async function searchFormCustomers(ctx: OrgContext, q: string) {
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
    select: CUSTOMER_FORM_SELECT,
    orderBy: { displayName: 'asc' },
    take: FORM_PICKER_SEARCH,
  })
  return rows.map((row) => presentCustomer(row))
}

/** Remote item hits for the sales document picker (same shape as bootstrap). */
export async function searchFormItems(
  ctx: OrgContext,
  q: string,
  options: { includeOnHand?: boolean } = {},
) {
  const needle = q.trim()
  if (!needle) return []
  const includeOnHand = options.includeOnHand === true
  const rows = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      OR: [
        { name: { contains: needle, mode: 'insensitive' } },
        { sku: { contains: needle, mode: 'insensitive' } },
        { barcode: { contains: needle, mode: 'insensitive' } },
        { salesDescription: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: ITEM_FORM_SELECT,
    orderBy: { name: 'asc' },
    take: FORM_PICKER_SEARCH,
  })
  const trackedIds = includeOnHand
    ? rows
        .filter((item) => item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY')
        .map((item) => item.id)
    : []
  const positions = includeOnHand
    ? await positionsOf(db as unknown as Tx, ctx.orgId, trackedIds)
    : new Map()
  return rows.map((row) => presentItem(row, ctx.features.enableTax, includeOnHand, positions))
}

function presentCustomer(customer: CustomerFormRow) {
  return {
    id: customer.id,
    label: customer.displayName,
    email: customer.email,
    paymentTermId: customer.paymentTermId,
    currencyCode: customer.currencyCode,
    priceLevel: customer.priceLevel,
    balance: null as string | null,
    billingAddress: postalAddress(
      customer.billingLine1,
      customer.billingLine2,
      customer.billingCity,
      customer.billingRegion,
      customer.billingPostalCode,
      customer.billingCountry,
    ),
    shippingAddress: postalAddress(
      customer.shippingLine1,
      customer.shippingLine2,
      customer.shippingCity,
      customer.shippingRegion,
      customer.shippingPostalCode,
      customer.shippingCountry,
    ),
  }
}

function presentItem(
  item: ItemFormRow,
  enableTax: boolean,
  includeOnHand: boolean,
  positions: Map<string, { quantity: Decimal }>,
) {
  return {
    id: item.id,
    label: item.name,
    sku: item.sku,
    barcode: item.barcode,
    unitOfMeasure: item.unitOfMeasure,
    trackLots: Boolean(item.trackLots || item.pharmacyControlled),
    trackSerials: Boolean(item.trackSerials),
    pharmacyControlled: Boolean(item.pharmacyControlled),
    price: item.salesPrice?.toString() ?? null,
    wholesalePrice: item.wholesalePrice?.toString() ?? null,
    description: item.salesDescription ?? item.description ?? item.name,
    taxCodeId: enableTax ? item.salesTaxCodeId : null,
    type: item.type,
    group: ITEM_GROUPS[item.type],
    onHand:
      item.type === 'INVENTORY' || item.type === 'INVENTORY_ASSEMBLY'
        ? includeOnHand
          ? (positions.get(item.id)?.quantity ?? new Decimal(0)).toFixed(2)
          : null
        : null,
    components:
      item.type === 'GROUP'
        ? item.bomParents
            .filter((row) => row.component.isActive)
            .map((row) => ({
              itemId: row.component.id,
              label: row.component.name,
              quantity: row.quantity.toString(),
              price: row.component.salesPrice?.toString() ?? null,
              wholesalePrice: row.component.wholesalePrice?.toString() ?? null,
              description:
                row.component.salesDescription ??
                row.component.description ??
                row.component.name,
              taxCodeId: enableTax ? row.component.salesTaxCodeId : null,
              type: row.component.type,
            }))
        : undefined,
  }
}

async function loadCustomersByIds(orgId: string, ids: string[]) {
  return db.customer.findMany({
    where: { orgId, id: { in: ids } },
    select: CUSTOMER_FORM_SELECT,
  })
}

async function loadItemsByIds(orgId: string, ids: string[]) {
  return db.item.findMany({
    where: { orgId, id: { in: ids } },
    select: ITEM_FORM_SELECT,
  })
}

function uniqueIds(ids: string[] | undefined) {
  return [...new Set((ids ?? []).filter(Boolean))]
}

/** Accounts a sales receipt can deposit into, bank and cash first. */
export async function depositAccountChoices(ctx: OrgContext) {
  const chart = await selectableAccounts(ctx, { withBalances: true })
  return accountOptions(chart, {
    prefer: ['BANK', 'UNDEPOSITED_FUNDS', 'CREDIT_CARD', 'OTHER_CURRENT_ASSET'],
    showBalance: true,
  })
}

function postalAddress(
  line1: string | null,
  line2: string | null,
  city: string | null,
  region: string | null,
  postalCode: string | null,
  country: string | null,
) {
  const place = [city, region, postalCode].map((part) => part?.trim()).filter(Boolean).join(', ')
  return [line1, line2, place, country].map((part) => part?.trim()).filter(Boolean).join('\n')
}

/** Bank / undeposited accounts for a sales receipt — including when fulfilling an order. */
export async function loadDepositAccounts(ctx: OrgContext) {
  const chart = await selectableAccounts(ctx, { withBalances: true })
  return accountOptions(chart, {
    prefer: ['BANK', 'UNDEPOSITED_FUNDS', 'CREDIT_CARD', 'OTHER_CURRENT_ASSET'],
    showBalance: true,
  })
}

export const ITEM_GROUPS: Record<string, string> = {
  INVENTORY: 'Inventory products',
  INVENTORY_ASSEMBLY: 'Inventory assemblies',
  NON_INVENTORY: 'Non-inventory products',
  SERVICE: 'Services',
  OTHER_CHARGE: 'Other charges',
  DISCOUNT: 'Discounts',
  SUBTOTAL: 'Subtotals',
  GROUP: 'Groups',
  PAYMENT: 'Payments',
}

export { MONEY_SUBTYPES }
