'use client'

import { useActionState, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDownIcon } from 'lucide-react'
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
  DOCUMENT_KIND_LABELS,
  documentKindFormKey,
  INVENTORY_DOCUMENT_KINDS,
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  MODULE_FORM_KEYS,
  PURCHASE_DOCUMENT_KINDS,
  SALES_DOCUMENT_KINDS,
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
  hint?: string
  defaultChecked?: boolean
  disabled?: boolean
  badge?: string
}) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5',
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
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
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

function DeepLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  )
}

function AppAccordion({
  flag,
  flags,
  defaultOpen,
  children,
}: {
  flag: ModuleFlag
  flags: OrgFeatureFlags
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const meta = MODULE_FLAG_LABELS[flag]
  const granted = flags.grantedModules[flag]
  const enabled = flags.modules[flag]
  const hasBody = Boolean(children)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-stretch gap-1">
        <label className="flex min-w-0 flex-1 items-start justify-between gap-3 px-3 py-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{meta.label}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  !granted
                    ? 'bg-muted text-muted-foreground'
                    : enabled
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {!granted ? 'Not granted' : enabled ? 'On' : 'Off'}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
          </span>
          {granted ? (
            <span className="relative mt-0.5 inline-flex shrink-0 items-center">
              <input
                type="checkbox"
                name={MODULE_FORM_KEYS[flag]}
                value="true"
                defaultChecked={enabled}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'relative h-6 w-11 rounded-full border border-border bg-muted transition-colors',
                  'peer-checked:border-primary peer-checked:bg-primary',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30',
                  'after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow after:transition-transform',
                  'peer-checked:after:translate-x-5',
                )}
              />
            </span>
          ) : (
            <input type="hidden" name={MODULE_FORM_KEYS[flag]} value="false" />
          )}
        </label>
        {hasBody ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Collapse ${meta.label}` : `Expand ${meta.label}`}
            onClick={() => setOpen((value) => !value)}
            className="grid w-10 shrink-0 place-items-center border-l border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronDownIcon
              className={cn('size-4 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {hasBody ? (
        <div
          hidden={!open}
          className="space-y-3 border-t border-border bg-muted/20 px-3 py-3"
        >
          {children}
        </div>
      ) : null}
    </div>
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

const APP_NESTED: Partial<
  Record<
    ModuleFlag,
    (flags: OrgFeatureFlags, links: { canManageUsers: boolean }) => ReactNode
  >
> = {
  sales: (flags) => (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Document types
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {SALES_DOCUMENT_KINDS.map((kind) => (
          <SwitchRow
            key={kind}
            name={documentKindFormKey('sales', kind)}
            label={DOCUMENT_KIND_LABELS.sales[kind]}
            defaultChecked={flags.documentKinds.sales[kind]}
          />
        ))}
      </div>
      <SwitchRow
        name="allowDocumentDelete"
        label="Delete documents and payments"
        hint="Invoices, bills, receipts, transfers, deposits, stock adjustments."
        defaultChecked={flags.allowDocumentDelete}
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <DeepLink href="/settings/templates">Document templates</DeepLink>
        <DeepLink href="/settings/tax">Tax settings</DeepLink>
      </div>
    </>
  ),
  customers: (flags) => (
    <>
      <SwitchRow
        name="allowCustomerDelete"
        label="Delete / merge customers"
        hint="Unused customers can be removed; those with history are merged."
        defaultChecked={flags.allowCustomerDelete}
      />
      <SwitchRow
        name="enableCustomerPortal"
        label="Enable customer portal"
        hint="When on, staff can give customers a login so they view their invoices and balance."
        defaultChecked={flags.enableCustomerPortal}
      />
    </>
  ),
  purchases: (flags) => (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Document types
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PURCHASE_DOCUMENT_KINDS.map((kind) => (
          <SwitchRow
            key={kind}
            name={documentKindFormKey('purchases', kind)}
            label={DOCUMENT_KIND_LABELS.purchases[kind]}
            defaultChecked={flags.documentKinds.purchases[kind]}
          />
        ))}
      </div>
    </>
  ),
  vendors: (flags) => (
    <SwitchRow
      name="allowVendorDelete"
      label="Delete / merge vendors"
      hint="Unused vendors can be removed; those with history are merged."
      defaultChecked={flags.allowVendorDelete}
    />
  ),
  inventory: (flags) => (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Work areas
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {INVENTORY_DOCUMENT_KINDS.map((kind) => (
          <SwitchRow
            key={kind}
            name={documentKindFormKey('inventory', kind)}
            label={DOCUMENT_KIND_LABELS.inventory[kind]}
            defaultChecked={flags.documentKinds.inventory[kind]}
          />
        ))}
      </div>
      <SwitchRow
        name="allowItemDelete"
        label="Delete / merge items"
        hint="Unused items can be removed; those on documents are merged."
        defaultChecked={flags.allowItemDelete}
      />
    </>
  ),
  pos: () => (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <DeepLink href="/pos/settings">POS configuration</DeepLink>
    </div>
  ),
  approvals: (flags) => (
    <SwitchRow
      name="enableDocumentApprovals"
      label="Require approval before posting"
      hint="Sales invoices, bills, and other gated transactions stay off the ledger until approved. POS still posts at the till."
      defaultChecked={flags.enableDocumentApprovals}
    />
  ),
  accounting: (flags) => (
    <>
      <SwitchRow
        name="allowAccountDelete"
        label="Delete / merge chart accounts"
        hint="Unused accounts can be removed; linked accounts are merged."
        defaultChecked={flags.allowAccountDelete}
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <DeepLink href="/settings/accounts">Chart of accounts</DeepLink>
        <DeepLink href="/settings/tax">Tax settings</DeepLink>
        <DeepLink href="/settings/payment-terms">Payment terms</DeepLink>
      </div>
    </>
  ),
  journals: (flags) => (
    <SwitchRow
      name="allowJournalDelete"
      label="Delete journal entries"
      hint="Every journal — list and detail — can be deleted when on."
      defaultChecked={flags.allowJournalDelete}
    />
  ),
  databases: (_flags, links) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <DeepLink href="/databases">Databases &amp; backups</DeepLink>
      {links.canManageUsers ? (
        <DeepLink href="/settings/users">Company users</DeepLink>
      ) : null}
      <DeepLink href="/settings/user-history">User history</DeepLink>
      <DeepLink href="/settings/activity">Trash</DeepLink>
    </div>
  ),
}

export function FeaturesForm({
  flags,
  requests = [],
  canManageUsers = false,
}: {
  flags: OrgFeatureFlags
  requests?: CompanyRequest[]
  canManageUsers?: boolean
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
  const linkCtx = { canManageUsers }

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
            <h3 className="text-sm font-semibold">Apps &amp; configuration</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Expand an app to manage its nested features and document types. Turn the master switch
              off to hide the app from Home and the Apps header for everyone in this company.
            </p>
          </div>

          {granted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No apps are granted yet. Ask the system owner under Databases to grant apps for this
              company. Nested switches below still apply once an app is granted.
            </p>
          ) : null}

          <div className="space-y-2">
            {MODULE_FLAGS.map((key) => {
              const render = APP_NESTED[key]
              return (
                <AppAccordion
                  key={key}
                  flag={key}
                  flags={flags}
                  defaultOpen={key === 'sales' || key === 'purchases' || key === 'inventory'}
                >
                  {render ? render(flags, linkCtx) : null}
                </AppAccordion>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">People &amp; data</h3>
          <p className="text-xs text-muted-foreground">
            Company-wide pages that are not launcher apps — open them here without leaving Settings.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3 py-3">
            {canManageUsers ? (
              <DeepLink href="/settings/users">Company users</DeepLink>
            ) : (
              <span className="text-xs text-muted-foreground">Company users</span>
            )}
            <DeepLink href="/settings/user-history">User history</DeepLink>
            <DeepLink href="/settings/activity">Trash</DeepLink>
            <DeepLink href="/settings/profile">Your profile</DeepLink>
            <DeepLink href="/settings/templates">Templates</DeepLink>
            <DeepLink href="/settings/tax">Tax</DeepLink>
          </div>
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
