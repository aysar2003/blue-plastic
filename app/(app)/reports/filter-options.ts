import 'server-only'

import { db } from '@/server/db'
import type { ReportFilterKind } from '@/server/reports/catalogue'

export type FilterOption = { value: string; label: string; hint?: string }

export type ReportFilterOptions = {
  customers: FilterOption[]
  vendors: FilterOption[]
  items: FilterOption[]
  accounts: FilterOption[]
  stores: FilterOption[]
}

/** Choices for the shared entity pickers on table reports and statements. */
export async function loadFilterOptions(
  orgId: string,
  kinds: ReportFilterKind[],
): Promise<ReportFilterOptions> {
  const [customers, vendors, items, accounts, stores] = await Promise.all([
    kinds.includes('customer')
      ? db.customer.findMany({
          where: { orgId, isActive: true },
          select: { id: true, displayName: true },
          orderBy: { displayName: 'asc' },
          take: 500,
        })
      : Promise.resolve([]),
    kinds.includes('vendor')
      ? db.vendor.findMany({
          where: { orgId, isActive: true },
          select: { id: true, displayName: true },
          orderBy: { displayName: 'asc' },
          take: 500,
        })
      : Promise.resolve([]),
    kinds.includes('item')
      ? db.item.findMany({
          where: { orgId, deletedAt: null, isActive: true },
          select: { id: true, name: true, sku: true },
          orderBy: { name: 'asc' },
          take: 500,
        })
      : Promise.resolve([]),
    kinds.includes('account')
      ? db.ledgerAccount.findMany({
          where: { orgId, isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
          take: 500,
        })
      : Promise.resolve([]),
    kinds.includes('store')
      ? db.store.findMany({
          where: { orgId, isActive: true },
          select: { id: true, name: true, isOffice: true },
          orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
          take: 500,
        })
      : Promise.resolve([]),
  ])

  return {
    customers: customers.map((row) => ({ value: row.id, label: row.displayName })),
    vendors: vendors.map((row) => ({ value: row.id, label: row.displayName })),
    items: items.map((row) => ({
      value: row.id,
      label: row.name,
      hint: row.sku ?? undefined,
    })),
    accounts: accounts.map((row) => ({
      value: row.id,
      label: `${row.code} ${row.name}`,
    })),
    stores: stores.map((row) => ({
      value: row.id,
      label: row.isOffice ? `${row.name} (office)` : row.name,
    })),
  }
}
