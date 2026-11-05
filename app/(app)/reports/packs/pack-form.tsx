'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { createPackForm } from './actions'

export function PackForm({
  reportKeys,
  defaults,
}: {
  reportKeys: string[]
  defaults?: {
    name?: string
    description?: string | null
    reportKeys?: string[]
    cadence?: string
    emailTo?: string | null
  }
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(createPackForm, idleState)
  const handled = useRef(false)
  const selected = new Set(defaults?.reportKeys ?? ['profit-loss', 'balance-sheet'])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      router.push('/reports/packs')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-4">
      <FormStatus state={state} />
      <Card>
        <CardContent className="space-y-3 p-4">
          <Field name="name" label="Name" required error={state.fieldErrors?.name}>
            <Input
              {...fieldProps('name', state.fieldErrors?.name)}
              defaultValue={defaults?.name ?? ''}
              required
              placeholder="Month-end pack"
            />
          </Field>
          <Field name="description" label="Description" error={state.fieldErrors?.description}>
            <Input
              name="description"
              defaultValue={defaults?.description ?? ''}
              placeholder="Optional note for the team"
            />
          </Field>
          <Field name="cadence" label="Schedule" error={state.fieldErrors?.cadence}>
            <NativeSelect name="cadence" defaultValue={defaults?.cadence ?? 'MANUAL'}>
              <option value="MANUAL">Manual only</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </NativeSelect>
          </Field>
          <Field
            name="emailTo"
            label="Email after run"
            hint="Optional. Needs company SMTP under Settings."
            error={state.fieldErrors?.emailTo}
          >
            <Input
              {...fieldProps('emailTo', state.fieldErrors?.emailTo)}
              type="email"
              defaultValue={defaults?.emailTo ?? ''}
              placeholder="owner@example.com"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-medium">Reports in this pack</p>
          <div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
            {reportKeys.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="reportKeys"
                  value={key}
                  defaultChecked={selected.has(key)}
                />
                <span className="tabular">{key}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save pack</SubmitButton>
      </div>
    </form>
  )
}
