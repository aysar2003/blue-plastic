'use client'

import { useActionState } from 'react'

import { updateFeatureFlagsForm } from '@/app/(app)/settings/(work)/organization/actions'
import { idleState } from '@/components/forms/action-state'
import { CREATOR_BRAND_NAME, type OrgFeatureFlags } from '@/lib/feature-flags'
import { PRODUCT_NAME } from '@/lib/product-brand'

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string
  label: string
  hint: string
  defaultChecked: boolean
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-1 size-4 rounded border-input"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

export function FeaturesForm({ flags }: { flags: OrgFeatureFlags }) {
  const [state, action, pending] = useActionState(updateFeatureFlagsForm, idleState)

  return (
    <form action={action} className="space-y-8">
      {state.status !== 'idle' && state.message ? (
        <p
          className={
            state.status === 'success' ? 'text-sm text-primary' : 'text-sm text-destructive'
          }
        >
          {state.message}
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Delete</h3>
        <p className="text-xs text-muted-foreground">
          Organisation switches — when off, Delete is hidden and the server refuses it.
          Who may use each switch is set per user under Settings → Users (only the owner
          has master-data delete by default).
        </p>
        <div className="grid gap-2 sm:grid-cols-1">
          <Toggle
            name="allowCustomerDelete"
            label="Delete / merge customers"
            hint="Unused customers can be removed; those with history are merged."
            defaultChecked={flags.allowCustomerDelete}
          />
          <Toggle
            name="allowVendorDelete"
            label="Delete / merge vendors"
            hint="Unused vendors can be removed; those with history are merged."
            defaultChecked={flags.allowVendorDelete}
          />
          <Toggle
            name="allowItemDelete"
            label="Delete / merge items"
            hint="Unused items can be removed; those on documents are merged."
            defaultChecked={flags.allowItemDelete}
          />
          <Toggle
            name="allowAccountDelete"
            label="Delete / merge chart accounts"
            hint="Unused accounts can be removed; linked accounts are merged."
            defaultChecked={flags.allowAccountDelete}
          />
          <Toggle
            name="allowDocumentDelete"
            label="Delete documents and payments"
            hint="Invoices, bills, receipts, transfers, deposits, stock adjustments."
            defaultChecked={flags.allowDocumentDelete}
          />
          <Toggle
            name="allowJournalDelete"
            label="Delete journal entries"
            hint="Every journal — list and detail — can be deleted when on."
            defaultChecked={flags.allowJournalDelete}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Brand</h3>
        <p className="text-xs text-muted-foreground">
          Creator credit shown on the shell footer and the sign-in screen.
        </p>
        <Toggle
          name="showCreatorBrand"
          label={`Show ${CREATOR_BRAND_NAME}`}
          hint={`When on, “Developed by ${CREATOR_BRAND_NAME}” appears next to ${PRODUCT_NAME} on the shell footer and sign-in.`}
          defaultChecked={flags.showCreatorBrand}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Apps</h3>
        <p className="text-xs text-muted-foreground">
          Hide an app from the launcher and header when you do not use it.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            name="moduleSales"
            label="Sales"
            hint="Invoices, customers, payments"
            defaultChecked={flags.modules.sales}
          />
          <Toggle
            name="modulePurchases"
            label="Purchases"
            hint="Bills, vendors, expenses"
            defaultChecked={flags.modules.purchases}
          />
          <Toggle
            name="moduleBanking"
            label="Banking"
            hint="Accounts, transfers, deposits"
            defaultChecked={flags.modules.banking}
          />
          <Toggle
            name="moduleInventory"
            label="Inventory"
            hint="Products, stock, stores"
            defaultChecked={flags.modules.inventory}
          />
          <Toggle
            name="modulePos"
            label="Point of Sale"
            hint="Registers and till"
            defaultChecked={flags.modules.pos}
          />
          <Toggle
            name="moduleAccounting"
            label="Accounting"
            hint="Chart, journals, periods"
            defaultChecked={flags.modules.accounting}
          />
          <Toggle
            name="moduleReports"
            label="Reports"
            hint="Financial and operations reports"
            defaultChecked={flags.modules.reports}
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save configuration'}
      </button>
    </form>
  )
}
