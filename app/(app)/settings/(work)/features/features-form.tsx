'use client'

import { useActionState } from 'react'

import { updateFeatureFlagsForm } from '@/app/(app)/settings/(work)/organization/actions'
import { idleState } from '@/components/forms/action-state'
import type { OrgFeatureFlags } from '@/lib/feature-flags'

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
          When off, Delete is hidden and the server refuses it.
        </p>
        <div className="grid gap-2 sm:grid-cols-1">
          <Toggle
            name="allowJournalDelete"
            label="Delete journal entries"
            hint="Every journal — list and detail — can be deleted when on."
            defaultChecked={flags.allowJournalDelete}
          />
          <Toggle
            name="allowContactDelete"
            label="Delete customers and vendors"
            hint="Removes them from active lists (archive). Open balances must be cleared first."
            defaultChecked={flags.allowContactDelete}
          />
          <Toggle
            name="allowDocumentDelete"
            label="Delete documents and payments"
            hint="Invoices, bills, receipts, transfers, deposits, stock adjustments."
            defaultChecked={flags.allowDocumentDelete}
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
          label="Show Abdisalm Hero"
          hint="When on, the creator name appears next to HeroBooks on the shell footer and sign-in."
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
