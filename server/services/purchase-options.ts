import 'server-only'

import { accountOptions } from '@/lib/account-options'
import { Decimal } from '@/lib/money'
import { positionsOf } from '@/server/accounting/inventory'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { selectableAccounts } from '@/server/services/account.service'
import { subledgerBalances } from '@/server/services/contact.service'
import { listForPicker as listProjects } from '@/server/services/project.service'
import { ITEM_GROUPS } from '@/server/services/sales-options'

function mailingAddress(vendor: {
  billingLine1: string | null
  billingLine2: string | null
  billingCity: string | null
  billingRegion: string | null
  billingPostalCode: string | null
  billingCountry: string | null
}) {
  const place = [vendor.billingCity, vendor.billingRegion, vendor.billingPostalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  return [vendor.billingLine1, vendor.billingLine2, place, vendor.billingCountry]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('\n')
}

/** Everything the bill form needs, in one round trip. */
export async function loadPurchaseOptions(ctx: OrgContext) {
  const [vendors, customers, items, taxCodes, chart, terms, projects] = await Promise.all([
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: {
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
      },
      orderBy: { displayName: 'asc' },
    }),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    }),
    // Tracked stock is the main thing a purchase document buys, so it has to be
    // in the picker. Excluding it made receiving stock impossible.
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: {
        id: true, name: true, sku: true, purchaseCost: true, type: true,
        unitOfMeasure: true,
        purchaseDescription: true, description: true, purchaseTaxCodeId: true,
        expenseAccountId: true,
      },
      orderBy: { name: 'asc' },
    }),
    db.taxCode.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: {
        id: true, name: true, isInclusive: true,
        components: { select: { taxRate: { select: { rate: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    selectableAccounts(ctx, { withBalances: false }),
    db.paymentTerm.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true, type: true, dueDays: true },
      orderBy: [{ isDefault: 'desc' }, { dueDays: 'asc' }],
    }),
    listProjects(ctx),
  ])

  const trackedIds = items.filter((item) => item.type === 'INVENTORY').map((item) => item.id)
  const [positions, customerBalances] = await Promise.all([
    positionsOf(db as unknown as Tx, ctx.orgId, trackedIds),
    subledgerBalances(
      db,
      ctx,
      'customer',
      customers.map((customer) => customer.id),
    ),
  ])

  return {
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      label: vendor.displayName,
      email: vendor.email,
      paymentTermId: vendor.paymentTermId,
      mailingAddress: mailingAddress(vendor),
      defaultExpenseAccountId: vendor.defaultExpenseAccountId,
    })),
    customers: customers.map((customer) => {
      const balance = customerBalances.get(customer.id) ?? new Decimal(0)
      return {
        id: customer.id,
        label: customer.displayName,
        email: customer.email,
        balance: balance.toFixed(4),
        hint: balance.isZero()
          ? 'No balance'
          : balance.isPositive()
            ? `Owes you ${balance.toFixed(2)}`
            : `You owe ${balance.abs().toFixed(2)}`,
      }
    }),
    items: items.map((item) => ({
      id: item.id,
      label: item.sku ? `${item.sku} — ${item.name}` : item.name,
      unitOfMeasure: item.unitOfMeasure,
      price: item.purchaseCost?.toString() ?? null,
      description: item.purchaseDescription ?? item.description ?? item.name,
      taxCodeId: ctx.features.enableTax ? item.purchaseTaxCodeId : null,
      expenseAccountId: item.expenseAccountId,
      type: item.type,
      group: ITEM_GROUPS[item.type],
      onHand:
        item.type === 'INVENTORY'
          ? (positions.get(item.id)?.quantity ?? new Decimal(0)).toFixed(2)
          : null,
    })),
    taxCodes: ctx.features.enableTax
      ? taxCodes.map((code) => ({
          id: code.id,
          label: code.name,
          isInclusive: code.isInclusive,
          rate: code.components.reduce((total, c) => total + Number(c.taxRate.rate), 0),
        }))
      : [],
    // Where the money left from, on an expense. Bank and credit card lead.
    paymentAccounts: accountOptions(chart, {
      prefer: ['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'],
      showBalance: false,
    }),
    // Where a cost lands. Expenses lead, then the rest of the chart — a bill can
    // legitimately capitalise into a fixed asset or settle a liability.
    expenseAccounts: accountOptions(chart, {
      prefer: ['OPERATING_EXPENSE', 'OTHER_EXPENSE', 'DEPRECIATION'],
      preferTypes: ['EXPENSE'],
    }),
    terms,
    projects,
  }
}
