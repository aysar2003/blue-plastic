'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { savePaymentTermForm } from '../tax/actions'

export function PaymentTermButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New term
      </Button>
      {open ? <PaymentTermDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function PaymentTermDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [state, formAction] = useActionState(savePaymentTermForm, idleState)
  const [type, setType] = useState('NET_DAYS')
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      router.refresh()
      onClose()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, onClose])

  const e = state.fieldErrors

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New payment term</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="mt-4 space-y-4">
          <FormStatus state={state} />

          <Field name="name" label="Name" required error={e?.name}>
            <Input {...fieldProps('name', e?.name)} placeholder="Net 45" autoFocus required />
          </Field>

          <Field name="type" label="Type" required error={e?.type}>
            <NativeSelect
              {...fieldProps('type', e?.type)}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="DUE_ON_RECEIPT">Due on receipt</option>
              <option value="NET_DAYS">A number of days after the document date</option>
              <option value="DAY_OF_MONTH">A fixed day of the month</option>
            </NativeSelect>
          </Field>

          {type !== 'DUE_ON_RECEIPT' ? (
            <Field
              name="dueDays"
              label={type === 'NET_DAYS' ? 'Days' : 'Day of the month'}
              hint={type === 'DAY_OF_MONTH' ? 'Clamped to a day the month actually has.' : undefined}
              required
              error={e?.dueDays}
            >
              <Input
                {...fieldProps('dueDays', e?.dueDays, type === 'DAY_OF_MONTH')}
                inputMode="decimal"
                defaultValue={type === 'NET_DAYS' ? 30 : 15}
                className="tabular"
                required
              />
            </Field>
          ) : (
            <input type="hidden" name="dueDays" value="0" />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="discountPercent" label="Early settlement discount (%)" error={e?.discountPercent}>
              <Input {...fieldProps('discountPercent', e?.discountPercent)} inputMode="decimal" className="tabular" />
            </Field>
            <Field name="discountDays" label="If paid within (days)" error={e?.discountDays}>
              <Input {...fieldProps('discountDays', e?.discountDays)} inputMode="decimal" className="tabular" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDefault" value="true" className="size-4 rounded border-input" />
            Make this the default for new customers and vendors
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Create term</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
