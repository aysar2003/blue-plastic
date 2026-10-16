'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  cancelAppAccessRequest,
  requestMoreAppsForm,
  updateFeatureFlagsForm,
} from '@/app/(app)/settings/(work)/organization/actions'
import { idleState } from '@/components/forms/action-state'
import { Button } from '@/components/ui/button'
import {
  CREATOR_BRAND_NAME,
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  type ModuleFlag,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

function SwitchRow({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
  badge,
}: {
  name?: string
  label: string
  hint: string
  defaultChecked?: boolean
  disabled?: boolean
  badge?: string
}) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3',
        disabled && 'opacity-70',
      )}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      {name ? (
        <span className="relative mt-0.5 inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            name={name}
            value="true"
            defaultChecked={defaultChecked}
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              'relative h-6 w-11 rounded-full border border-border bg-muted transition-colors',
              'peer-checked:border-primary peer-checked:bg-primary',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30',
              'peer-disabled:cursor-not-allowed',
              'after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow after:transition-transform',
              'peer-checked:after:translate-x-5',
            )}
          />
        </span>
      ) : null}
    </label>
  )
}

type CompanyRequest = {
  id: string
  status: string
  apps: string[]
  note: string | null
  reviewNote: string | null
  at: string
}

export function FeaturesForm({
  flags,
  requests = [],
}: {
  flags: OrgFeatureFlags
  requests?: CompanyRequest[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateFeatureFlagsForm, idleState)
  const [requestState, requestAction, requestPending] = useActionState(requestMoreAppsForm, idleState)
  const [picked, setPicked] = useState<Record<ModuleFlag, boolean>>(() =>
    Object.fromEntries(MODULE_FLAGS.map((key) => [key, false])) as Record<ModuleFlag, boolean>,
  )
  const [cancelPending, startCancel] = useTransition()

  const granted = MODULE_FLAGS.filter((key) => flags.grantedModules[key])
  const locked = MODULE_FLAGS.filter((key) => !flags.grantedModules[key])
  const pendingRequest = requests.find((row) => row.status === 'PENDING')

  return (
    <div className="space-y-8">
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
          <div>
            <h3 className="text-sm font-semibold">Apps — on / off</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Only apps the system owner granted this company appear here. Turn one off to hide it
              from Home and the Apps header for everyone here. To get another app, request it below.
            </p>
          </div>
          {granted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No apps are granted yet. Ask the system owner under Databases to grant apps for this
              company.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {granted.map((key) => (
                <SwitchRow
                  key={key}
                  name={MODULE_FORM_KEYS[key]}
                  label={MODULE_FLAG_LABELS[key].label}
                  hint={MODULE_FLAG_LABELS[key].hint}
                  defaultChecked={flags.modules[key]}
                  badge={flags.modules[key] ? 'On' : 'Off'}
                />
              ))}
            </div>
          )}
          {/* Preserve unchecked granted keys as false; ungranted stay off via hidden fields. */}
          {locked.map((key) => (
            <input key={key} type="hidden" name={MODULE_FORM_KEYS[key]} value="false" />
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Delete</h3>
          <p className="text-xs text-muted-foreground">
            Organisation switches — when off, Delete is hidden and the server refuses it. Who may
            use each switch is set per user under Settings → Company users.
          </p>
          <div className="grid gap-2 sm:grid-cols-1">
            <SwitchRow
              name="allowCustomerDelete"
              label="Delete / merge customers"
              hint="Unused customers can be removed; those with history are merged."
              defaultChecked={flags.allowCustomerDelete}
            />
            <SwitchRow
              name="allowVendorDelete"
              label="Delete / merge vendors"
              hint="Unused vendors can be removed; those with history are merged."
              defaultChecked={flags.allowVendorDelete}
            />
            <SwitchRow
              name="allowItemDelete"
              label="Delete / merge items"
              hint="Unused items can be removed; those on documents are merged."
              defaultChecked={flags.allowItemDelete}
            />
            <SwitchRow
              name="allowAccountDelete"
              label="Delete / merge chart accounts"
              hint="Unused accounts can be removed; linked accounts are merged."
              defaultChecked={flags.allowAccountDelete}
            />
            <SwitchRow
              name="allowDocumentDelete"
              label="Delete documents and payments"
              hint="Invoices, bills, receipts, transfers, deposits, stock adjustments."
              defaultChecked={flags.allowDocumentDelete}
            />
            <SwitchRow
              name="allowJournalDelete"
              label="Delete journal entries"
              hint="Every journal — list and detail — can be deleted when on."
              defaultChecked={flags.allowJournalDelete}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Approvals (maker-checker)</h3>
          <p className="text-xs text-muted-foreground">
            International segregation of duties (SOX / COSO): the person who enters a sale or bill
            cannot post it alone. Documents wait in the Approvals app until an authorised checker
            approves. Point of Sale still posts at the till.
          </p>
          <SwitchRow
            name="enableDocumentApprovals"
            label="Require approval before posting"
            hint="Sales invoices, bills, and other gated transactions stay off the ledger until approved."
            defaultChecked={flags.enableDocumentApprovals}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Customer portal</h3>
          <p className="text-xs text-muted-foreground">
            Self-service login for customers — view-only balance, invoices, payments, and
            statements.
          </p>
          <SwitchRow
            name="enableCustomerPortal"
            label="Enable customer portal"
            hint="When on, staff can give customers a login so they view their invoices and balance."
            defaultChecked={flags.enableCustomerPortal}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Brand</h3>
          <p className="text-xs text-muted-foreground">
            Creator credit shown on the shell footer and the sign-in screen.
          </p>
          <SwitchRow
            name="showCreatorBrand"
            label={`Show ${CREATOR_BRAND_NAME}`}
            hint={`When on, “Developed by ${CREATOR_BRAND_NAME}” appears next to ${PRODUCT_NAME}.`}
            defaultChecked={flags.showCreatorBrand}
          />
        </section>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save configuration'}
        </button>
      </form>

      {locked.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold">Request more apps</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              These apps are not granted yet. Tick what you need; the system owner reviews the
              request under Databases and can approve or refuse.
            </p>
          </div>

          {pendingRequest ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm">
              <p className="font-medium text-foreground">
                Waiting for approval · {pendingRequest.apps.join(', ')}
              </p>
              {pendingRequest.note ? (
                <p className="mt-1 text-xs text-muted-foreground">{pendingRequest.note}</p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={cancelPending}
                onClick={() =>
                  startCancel(async () => {
                    const result = await cancelAppAccessRequest({ id: pendingRequest.id })
                    if (result.ok) {
                      toast.success('Request cancelled.')
                      router.refresh()
                    } else {
                      toast.error(result.error.message)
                    }
                  })
                }
              >
                Cancel request
              </Button>
            </div>
          ) : (
            <form action={requestAction} className="space-y-3">
              {requestState.status !== 'idle' && requestState.message ? (
                <p
                  className={
                    requestState.status === 'success'
                      ? 'text-sm text-primary'
                      : 'text-sm text-destructive'
                  }
                >
                  {requestState.message}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {locked.map((key) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      name={MODULE_FORM_KEYS[key]}
                      value="true"
                      className="mt-0.5 size-4 rounded border-input"
                      checked={picked[key]}
                      onChange={() => setPicked((prev) => ({ ...prev, [key]: !prev[key] }))}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {MODULE_FLAG_LABELS[key].label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {MODULE_FLAG_LABELS[key].hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                name="note"
                rows={2}
                placeholder="Why you need these apps (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button type="submit" size="sm" disabled={requestPending}>
                {requestPending ? 'Sending…' : 'Send request'}
              </Button>
            </form>
          )}

          {requests.filter((row) => row.status !== 'PENDING').length > 0 ? (
            <ul className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {requests
                .filter((row) => row.status !== 'PENDING')
                .slice(0, 5)
                .map((row) => (
                  <li key={row.id}>
                    <span className="font-medium text-foreground">{row.status.toLowerCase()}</span>
                    {' · '}
                    {row.apps.join(', ')}
                    {row.reviewNote ? ` — ${row.reviewNote}` : ''}
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
