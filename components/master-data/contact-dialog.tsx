'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import type { AccountPickerOption } from '@/lib/account-options'
import {
  createCustomerForm,
  createVendorForm,
  updateCustomerForm,
  updateVendorForm,
} from '@/app/(app)/customers/actions'

export type ContactSide = 'customer' | 'vendor'

export type ContactValues = {
  id?: string
  displayName?: string | null
  companyName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  taxRegistrationNumber?: string | null
  billingLine1?: string | null
  billingLine2?: string | null
  billingCity?: string | null
  billingRegion?: string | null
  billingPostalCode?: string | null
  billingCountry?: string | null
  shippingLine1?: string | null
  shippingCity?: string | null
  shippingPostalCode?: string | null
  paymentTermId?: string | null
  creditLimit?: string | null
  defaultExpenseAccountId?: string | null
  notes?: string | null
  agreementDate?: string | null
  balanceDate?: string | null
  balanceTime?: string | null
  reminderDays?: number | null
  files?: { id: string; kind: 'PHOTO' | 'AGREEMENT'; originalName: string }[]
}

export type Option = { id: string; label: string }

export function NewContactButton(props: {
  side: ContactSide
  terms: Option[]
  expenseAccounts?: AccountPickerOption[]
  today: string
  currency: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const label = props.side === 'customer' ? 'New customer' : 'New vendor'

  return (
    <>
      <Button size="sm" className={props.className} onClick={() => setOpen(true)}>
        <PlusIcon /> {label}
      </Button>
      {open ? <ContactDialog {...props} mode="create" onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function ContactDialog({
  side,
  mode,
  contact,
  terms,
  expenseAccounts = [],
  today,
  currency,
  onClose,
  defaultName,
  onCreated,
}: {
  side: ContactSide
  mode: 'create' | 'edit'
  contact?: ContactValues
  terms: Option[]
  expenseAccounts?: AccountPickerOption[]
  today: string
  currency: string
  onClose: () => void
  /** Pre-fills the name, when the dialog was opened by typing one into a picker. */
  defaultName?: string
  /** Hands the new record back to whatever opened this. */
  onCreated?: (record: { id: string; label: string }) => void
}) {
  const router = useRouter()
  const formAction =
    side === 'customer'
      ? mode === 'create'
        ? createCustomerForm
        : updateCustomerForm
      : mode === 'create'
        ? createVendorForm
        : updateVendorForm

  const [state, submit] = useActionState(formAction, idleState)
  const [openingBalanceDate, setOpeningBalanceDate] = useState(contact?.balanceDate ?? (mode === 'create' ? today : ''))
  const [agreementDate, setAgreementDate] = useState(contact?.agreementDate ?? '')
  const [defaultExpenseAccountId, setDefaultExpenseAccountId] = useState(
    contact?.defaultExpenseAccountId ?? '',
  )
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      if (state.created) onCreated?.({ id: state.created.id, label: state.created.label ?? '' })
      router.refresh()
      onClose()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, onClose, onCreated])

  const e = state.fieldErrors
  const noun = side === 'customer' ? 'customer' : 'vendor'

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? `New ${noun}` : `Edit ${contact?.displayName}`}</DialogTitle>
        </DialogHeader>

        <form action={submit} className="mt-4 space-y-5">
          <FormStatus state={state} />
          {contact?.id ? <input type="hidden" name="id" value={contact.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="displayName"
              label="Display name"
              hint="How they appear on documents and on the aging report."
              required
              error={e?.displayName}
            >
              <Input
                {...fieldProps('displayName', e?.displayName, true)}
                defaultValue={contact?.displayName ?? defaultName ?? ''}
                autoFocus
                required
              />
            </Field>
            <Field name="companyName" label="Company name" error={e?.companyName}>
              <Input {...fieldProps('companyName', e?.companyName)} defaultValue={contact?.companyName ?? ''} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="firstName" label="First name" error={e?.firstName}>
              <Input {...fieldProps('firstName', e?.firstName)} defaultValue={contact?.firstName ?? ''} />
            </Field>
            <Field name="lastName" label="Last name" error={e?.lastName}>
              <Input {...fieldProps('lastName', e?.lastName)} defaultValue={contact?.lastName ?? ''} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="email" label="Email" error={e?.email}>
              <Input {...fieldProps('email', e?.email)} type="email" defaultValue={contact?.email ?? ''} />
            </Field>
            <Field name="phone" label="Phone" error={e?.phone}>
              <Input {...fieldProps('phone', e?.phone)} defaultValue={contact?.phone ?? ''} />
            </Field>
            <Field name="mobile" label="Mobile" error={e?.mobile}>
              <Input {...fieldProps('mobile', e?.mobile)} defaultValue={contact?.mobile ?? ''} />
            </Field>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Billing address
            </p>
            <Field name="billingLine1" label="Address" error={e?.billingLine1}>
              <Input {...fieldProps('billingLine1', e?.billingLine1)} defaultValue={contact?.billingLine1 ?? ''} />
            </Field>
            <Field name="billingLine2" label="Address line 2" error={e?.billingLine2}>
              <Input {...fieldProps('billingLine2', e?.billingLine2)} defaultValue={contact?.billingLine2 ?? ''} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field name="billingCity" label="City" error={e?.billingCity}>
                <Input {...fieldProps('billingCity', e?.billingCity)} defaultValue={contact?.billingCity ?? ''} />
              </Field>
              <Field name="billingRegion" label="State" error={e?.billingRegion}>
                <Input {...fieldProps('billingRegion', e?.billingRegion)} defaultValue={contact?.billingRegion ?? ''} />
              </Field>
              <Field name="billingPostalCode" label="Postal code" error={e?.billingPostalCode}>
                <Input
                  {...fieldProps('billingPostalCode', e?.billingPostalCode)}
                  defaultValue={contact?.billingPostalCode ?? ''}
                />
              </Field>
              <Field name="billingCountry" label="Country" hint="Two letters" error={e?.billingCountry}>
                <Input
                  {...fieldProps('billingCountry', e?.billingCountry, true)}
                  defaultValue={contact?.billingCountry ?? ''}
                  maxLength={2}
                  className="uppercase"
                />
              </Field>
            </div>
          </div>

          {side === 'customer' ? (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Shipping address
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field name="shippingLine1" label="Address" error={e?.shippingLine1}>
                    <Input
                      {...fieldProps('shippingLine1', e?.shippingLine1)}
                      defaultValue={contact?.shippingLine1 ?? ''}
                    />
                  </Field>
                  <Field name="shippingCity" label="City" error={e?.shippingCity}>
                    <Input {...fieldProps('shippingCity', e?.shippingCity)} defaultValue={contact?.shippingCity ?? ''} />
                  </Field>
                  <Field name="shippingPostalCode" label="Postal code" error={e?.shippingPostalCode}>
                    <Input
                      {...fieldProps('shippingPostalCode', e?.shippingPostalCode)}
                      defaultValue={contact?.shippingPostalCode ?? ''}
                    />
                  </Field>
                </div>
              </div>
            </>
          ) : null}

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="paymentTermId" label="Payment terms" error={e?.paymentTermId}>
              <NativeSelect
                {...fieldProps('paymentTermId', e?.paymentTermId)}
                defaultValue={contact?.paymentTermId ?? ''}
              >
                <option value="">— none —</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field name="taxRegistrationNumber" label="Tax registration number" error={e?.taxRegistrationNumber}>
              <Input
                {...fieldProps('taxRegistrationNumber', e?.taxRegistrationNumber)}
                defaultValue={contact?.taxRegistrationNumber ?? ''}
              />
            </Field>
          </div>

          {side === 'customer' ? (
            <Field
              name="creditLimit"
              label={`Credit limit (${currency})`}
              hint="Recorded now; invoicing warns against it in a later phase."
              error={e?.creditLimit}
            >
              <Input
                {...fieldProps('creditLimit', e?.creditLimit, true)}
                inputMode="decimal"
                className="tabular"
                defaultValue={contact?.creditLimit ?? ''}
              />
            </Field>
          ) : (
            <Field
              name="defaultExpenseAccountId"
              label="Default expense account"
              hint="Pre-selected on a bill, so routine spending is categorised the same way every time."
              error={e?.defaultExpenseAccountId}
            >
              <AccountPicker
                id="defaultExpenseAccountId"
                name="defaultExpenseAccountId"
                options={expenseAccounts}
                value={defaultExpenseAccountId || null}
                onChange={(next) => setDefaultExpenseAccountId(next ?? '')}
                placeholder="— none —"
                clearable
                error={e?.defaultExpenseAccountId}
              />
            </Field>
          )}

          <Field name="notes" label="Notes" error={e?.notes}>
            <Input {...fieldProps('notes', e?.notes)} defaultValue={contact?.notes ?? ''} />
          </Field>

          {side === 'customer' ? (
            <CustomerRegistration
              mode={mode}
              currency={currency}
              today={today}
              contact={contact}
              openingBalanceDate={openingBalanceDate}
              onOpeningBalanceDate={setOpeningBalanceDate}
              agreementDate={agreementDate}
              onAgreementDate={setAgreementDate}
              errors={e}
            />
          ) : mode === 'create' ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-3 text-xs text-muted-foreground">
                What was already owed to this vendor when the books started. It posts to Accounts Payable against Opening Balance Equity.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="openingBalance" label={`Opening balance (${currency})`} error={e?.openingBalance}>
                  <Input
                    {...fieldProps('openingBalance', e?.openingBalance)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="tabular"
                  />
                </Field>
                <Field name="openingBalanceDate" label="As at" error={e?.openingBalanceDate}>
                  <DateField
                    id="openingBalanceDate"
                    name="openingBalanceDate"
                    value={openingBalanceDate}
                    onChange={setOpeningBalanceDate}
                    today={today}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">
              {mode === 'create' ? `Create ${noun}` : 'Save changes'}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CustomerRegistration({
  mode,
  currency,
  today,
  contact,
  openingBalanceDate,
  onOpeningBalanceDate,
  agreementDate,
  onAgreementDate,
  errors,
}: {
  mode: 'create' | 'edit'
  currency: string
  today: string
  contact?: ContactValues
  openingBalanceDate: string
  onOpeningBalanceDate: (value: string) => void
  agreementDate: string
  onAgreementDate: (value: string) => void
  errors?: Record<string, string[]>
}) {
  const photo = contact?.files?.find((file) => file.kind === 'PHOTO')
  const papers = contact?.files?.filter((file) => file.kind === 'AGREEMENT') ?? []
  const photoSrc = contact?.id && photo ? `/api/customers/${contact.id}/files/${photo.id}` : null

  return (
    <div className="space-y-4 rounded-md border bg-muted/40 p-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Balance and agreement</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Payment terms are chosen above. Record the balance, the day and time it was taken, and the date of the debt
          agreement. The amount posts to Accounts Receivable.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === 'create' ? (
          <Field name="openingBalance" label={`Opening balance (${currency})`} error={errors?.openingBalance}>
            <Input
              {...fieldProps('openingBalance', errors?.openingBalance)}
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
            />
          </Field>
        ) : null}
        <Field name="openingBalanceDate" label="Balance date" error={errors?.openingBalanceDate}>
          <DateField
            id="openingBalanceDate"
            name="openingBalanceDate"
            value={openingBalanceDate}
            onChange={onOpeningBalanceDate}
            today={today}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="balanceTime" label="Balance time" hint="The clock time the balance was taken." error={errors?.balanceTime}>
          <Input {...fieldProps('balanceTime', errors?.balanceTime, true)} type="time" defaultValue={contact?.balanceTime ?? ''} />
        </Field>
        <Field name="agreementDate" label="Agreement date" hint="The day the debt agreement was signed." error={errors?.agreementDate}>
          <DateField
            id="agreementDate"
            name="agreementDate"
            value={agreementDate}
            onChange={onAgreementDate}
            today={today}
          />
        </Field>
      </div>

      <Field
        name="reminderDays"
        label="Balance reminder"
        hint="The warning drops down at the top this many days before the balance time."
        error={errors?.reminderDays}
      >
        <NativeSelect
          {...fieldProps('reminderDays', errors?.reminderDays, true)}
          defaultValue={contact?.reminderDays ? String(contact.reminderDays) : ''}
        >
          <option value="">— none —</option>
          <option value="3">3 days before</option>
          <option value="5">5 days before</option>
          <option value="7">7 days before</option>
        </NativeSelect>
      </Field>

      <Field name="photo" label="Customer photo" hint="JPEG, PNG, or WebP, up to 3 MB." error={errors?.photo}>
        <PhotoField existingSrc={photoSrc} />
      </Field>

      <Field
        name="agreements"
        label="Agreement papers"
        hint="The debt agreement. PDF or a picture, up to 4 files, 4 MB each."
        error={errors?.agreements}
      >
        {papers.length > 0 ? (
          <ul className="mb-2 space-y-1 text-sm">
            {papers.map((paper) => (
              <li key={paper.id}>
                <a
                  href={contact?.id ? `/api/customers/${contact.id}/files/${paper.id}` : undefined}
                  className="text-[#0b4f6c] underline-offset-4 hover:underline"
                >
                  {paper.originalName}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <Input {...fieldProps('agreements', errors?.agreements, true)} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
      </Field>
    </div>
  )
}

function PhotoField({ existingSrc }: { existingSrc: string | null }) {
  const [preview, setPreview] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {preview || existingSrc ? (
        <img src={preview ?? existingSrc ?? ''} alt="" className="size-20 rounded-md object-cover" />
      ) : null}
      <Input
        id="photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0]
          setPreview(file ? URL.createObjectURL(file) : null)
        }}
      />
    </div>
  )
}
