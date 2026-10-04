'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { saveAgencyForm, saveCodeForm, saveRateForm } from './actions'

type Option = { id: string; label: string }

function useCloseOnSuccess(status: string, message: string | undefined, onClose: () => void) {
  const router = useRouter()
  const handled = useRef(false)
  useEffect(() => {
    if (status === 'success' && !handled.current) {
      handled.current = true
      toast.success(message ?? 'Saved.')
      router.refresh()
      onClose()
    }
    if (status !== 'success') handled.current = false
  }, [status, message, router, onClose])
}

function TaxDialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description?: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        <div className="mt-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

/* --- Agency --------------------------------------------------------------- */

export function AgencyButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Agency
      </Button>
      {open ? <AgencyDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function AgencyDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(saveAgencyForm, idleState)
  useCloseOnSuccess(state.status, state.message, onClose)
  const e = state.fieldErrors

  return (
    <TaxDialog
      title="New tax agency"
      description="Who the tax is owed to, and how often it is filed."
      onClose={onClose}
    >
      <form action={formAction} className="space-y-4">
        <FormStatus state={state} />
        <Field name="name" label="Name" required error={e?.name}>
          <Input {...fieldProps('name', e?.name)} placeholder="Revenue Authority" autoFocus required />
        </Field>
        <Field name="registrationNumber" label="Your registration number" error={e?.registrationNumber}>
          <Input {...fieldProps('registrationNumber', e?.registrationNumber)} />
        </Field>
        <Field name="filingFrequency" label="Filing frequency" required error={e?.filingFrequency}>
          <NativeSelect {...fieldProps('filingFrequency', e?.filingFrequency)} defaultValue="MONTHLY">
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
          </NativeSelect>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Saving…">Create agency</SubmitButton>
        </div>
      </form>
    </TaxDialog>
  )
}

/* --- Rate ----------------------------------------------------------------- */

export function RateButton({ agencies, accounts }: { agencies: Option[]; accounts: Option[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" disabled={agencies.length === 0} onClick={() => setOpen(true)}>
        <PlusIcon /> Rate
      </Button>
      {open ? <RateDialog agencies={agencies} accounts={accounts} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function RateDialog({
  agencies,
  accounts,
  onClose,
}: {
  agencies: Option[]
  accounts: Option[]
  onClose: () => void
}) {
  const [state, formAction] = useActionState(saveRateForm, idleState)
  useCloseOnSuccess(state.status, state.message, onClose)
  const e = state.fieldErrors

  return (
    <TaxDialog
      title="New tax rate"
      description="A single percentage owed to one agency. Combine rates into a tax code to charge them together."
      onClose={onClose}
    >
      <form action={formAction} className="space-y-4">
        <FormStatus state={state} />

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field name="name" label="Name" required error={e?.name}>
            <Input {...fieldProps('name', e?.name)} placeholder="VAT" autoFocus required />
          </Field>
          <Field name="percent" label="Rate (%)" hint="e.g. 16" required error={e?.percent}>
            <Input
              {...fieldProps('percent', e?.percent, true)}
              inputMode="decimal"
              className="tabular"
              placeholder="16"
              required
            />
          </Field>
        </div>

        <Field name="agencyId" label="Agency" required error={e?.agencyId}>
          <NativeSelect {...fieldProps('agencyId', e?.agencyId)} required>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field name="appliesTo" label="Applies to" required error={e?.appliesTo}>
          <NativeSelect {...fieldProps('appliesTo', e?.appliesTo)} defaultValue="BOTH">
            <option value="BOTH">Sales and purchases</option>
            <option value="SALES">Sales only</option>
            <option value="PURCHASES">Purchases only</option>
          </NativeSelect>
        </Field>

        <Field
          name="salesAccountId"
          label="Sales tax account"
          hint="Defaults to Sales Tax Payable — tax collected is money held for the authority, not income."
          error={e?.salesAccountId}
        >
          <NativeSelect {...fieldProps('salesAccountId', e?.salesAccountId, true)} defaultValue="">
            <option value="">Sales Tax Payable (default)</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Saving…">Create rate</SubmitButton>
        </div>
      </form>
    </TaxDialog>
  )
}

/* --- Code ----------------------------------------------------------------- */

type Component = { key: number; taxRateId: string; isCompound: boolean }

export function CodeButton({ rates }: { rates: (Option & { rate: string })[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" disabled={rates.length === 0} onClick={() => setOpen(true)}>
        <PlusIcon /> Tax code
      </Button>
      {open ? <CodeDialog rates={rates} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function CodeDialog({
  rates,
  onClose,
}: {
  rates: (Option & { rate: string })[]
  onClose: () => void
}) {
  const [state, formAction] = useActionState(saveCodeForm, idleState)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isInclusive, setIsInclusive] = useState(false)
  const [components, setComponents] = useState<Component[]>([
    { key: 1, taxRateId: rates[0]?.id ?? '', isCompound: false },
  ])
  const nextKey = useRef(2)
  useCloseOnSuccess(state.status, state.message, onClose)

  const payload = JSON.stringify({
    name,
    description,
    isInclusive,
    components: components
      .filter((component) => component.taxRateId)
      .map((component, index) => ({
        taxRateId: component.taxRateId,
        sequence: index + 1,
        isCompound: component.isCompound,
      })),
  })

  return (
    <TaxDialog
      title="New tax code"
      description="What someone picks on a document line. One code can combine several rates."
      onClose={onClose}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="payload" value={payload} />
        <FormStatus state={state} />

        <Field name="code-name" label="Name" required>
          <Input
            id="code-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Standard VAT 16%"
            autoFocus
            required
          />
        </Field>

        <Field name="code-description" label="Description">
          <Input
            id="code-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={isInclusive}
            onChange={(event) => setIsInclusive(event.target.checked)}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            Prices include this tax
            <span className="block text-xs text-muted-foreground">
              The tax is extracted from the price rather than added to it, so the total stays exactly what
              the customer was quoted.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">Rates</p>
          {components.map((component, index) => (
            <div key={component.key} className="flex items-center gap-2">
              <NativeSelect
                aria-label={`Rate ${index + 1}`}
                value={component.taxRateId}
                onChange={(event) =>
                  setComponents((current) =>
                    current.map((c) =>
                      c.key === component.key ? { ...c, taxRateId: event.target.value } : c,
                    ),
                  )
                }
              >
                {rates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.label} ({(Number(rate.rate) * 100).toFixed(2)}%)
                  </option>
                ))}
              </NativeSelect>

              {index > 0 ? (
                <label className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={component.isCompound}
                    onChange={(event) =>
                      setComponents((current) =>
                        current.map((c) =>
                          c.key === component.key ? { ...c, isCompound: event.target.checked } : c,
                        ),
                      )
                    }
                    className="size-3.5 rounded border-input"
                  />
                  compound
                </label>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove rate"
                disabled={components.length <= 1}
                onClick={() =>
                  setComponents((current) => current.filter((c) => c.key !== component.key))
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setComponents((current) => [
                ...current,
                { key: nextKey.current++, taxRateId: rates[0]?.id ?? '', isCompound: false },
              ])
            }
          >
            <PlusIcon /> Add rate
          </Button>

          <p className="text-xs text-muted-foreground">
            A compound rate is charged on the running total including the rates above it, so the order
            changes the answer.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Saving…" disabled={name.trim() === ''}>
            Create tax code
          </SubmitButton>
        </div>
      </form>
    </TaxDialog>
  )
}
