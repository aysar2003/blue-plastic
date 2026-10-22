'use client'

import { StatementPicker } from '@/app/(app)/reports/statements/[kind]/statement-picker'
import type { ReportFilterKind } from '@/server/reports/catalogue'

type Option = { value: string; label: string; hint?: string }

/**
 * Entity pickers for catalogue table reports. Writes `customerId` / `vendorId` /
 * `itemId` / `accountId` / `storeId` into the URL so the same link is the same report.
 */
export function ReportEntityFilters({
  kinds,
  values,
  options,
}: {
  kinds: ReportFilterKind[]
  values: {
    customerId?: string
    vendorId?: string
    itemId?: string
    accountId?: string
    storeId?: string
  }
  options: {
    customers?: Option[]
    vendors?: Option[]
    items?: Option[]
    accounts?: Option[]
    stores?: Option[]
  }
}) {
  if (kinds.length === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
      {kinds.includes('customer') && options.customers ? (
        <StatementPicker
          label="Customer"
          param="customerId"
          value={values.customerId ?? null}
          options={options.customers}
        />
      ) : null}
      {kinds.includes('vendor') && options.vendors ? (
        <StatementPicker
          label="Vendor"
          param="vendorId"
          value={values.vendorId ?? null}
          options={options.vendors}
        />
      ) : null}
      {kinds.includes('item') && options.items ? (
        <StatementPicker
          label="Item"
          param="itemId"
          value={values.itemId ?? null}
          options={options.items}
        />
      ) : null}
      {kinds.includes('account') && options.accounts ? (
        <StatementPicker
          label="Account"
          param="accountId"
          value={values.accountId ?? null}
          options={options.accounts}
        />
      ) : null}
      {kinds.includes('store') && options.stores ? (
        <StatementPicker
          label="Store"
          param="storeId"
          value={values.storeId ?? null}
          options={options.stores}
        />
      ) : null}
    </div>
  )
}
