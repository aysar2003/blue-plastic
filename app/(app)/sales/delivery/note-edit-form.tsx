'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { updateDeliveryNoteForm } from '@/app/(app)/sales/delivery/actions'

export function DeliveryNoteEditForm({
  id,
  carrier,
  notes,
}: {
  id: string
  carrier: string | null
  notes: string | null
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(updateDeliveryNoteForm, idleState)
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  const e = state.status === 'error' ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="text-sm font-semibold">Carrier & notes</h2>
      <p className="text-xs text-muted-foreground">
        Printed on the delivery note for the driver and the receiving door.
      </p>
      <Field name="carrier" label="Carrier / vehicle" error={e?.carrier}>
        <Input
          {...fieldProps('carrier', e?.carrier)}
          defaultValue={carrier ?? ''}
          placeholder="Truck, plate, or courier"
        />
      </Field>
      <Field name="notes" label="Notes / instructions" error={e?.notes}>
        <textarea
          {...fieldProps('notes', e?.notes)}
          defaultValue={notes ?? ''}
          rows={3}
          placeholder="Loading bay, fragile, call on arrival…"
          className="flex min-h-[4.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </Field>
      <FormStatus state={state} />
      <SubmitButton>Save note</SubmitButton>
    </form>
  )
}
