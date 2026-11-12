'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  createSubscriptionForm,
  updateSubscriptionForm,
} from '@/app/(app)/sales/subscriptions/actions'
import { idleState } from '@/components/forms/action-state'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { PickerOption } from '@/components/forms/entity-picker'
import {
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_LABELS,
} from '@/lib/validation/recurring'

type Frequency = (typeof RECURRING_FREQUENCIES)[number]

type Initial = {
  id: string
  name: string
  frequency: Frequency
  interval: number
  nextRunOn: string
  endOn: string | null
  isActive: boolean
  deferRevenue: boolean
  serviceMonths: number | null
  memo: string
  customerId: string
  amount: string
  lineDescription: string
}

export function SubscriptionForm({
  mode,
  today,
  currency,
  customers,
  initial,
}: {
  mode: 'create' | 'edit'
  today: string
  currency: string
  customers: PickerOption[]
  initial?: Initial
}) {
  const router = useRouter()
  const formAction = mode === 'create' ? createSubscriptionForm : updateSubscriptionForm
  const [state, action] = useActionState(formAction, idleState)
  const handled = useRef(false)

  const [name, setName] = useState(initial?.name ?? '')
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'MONTHLY')
  const [interval, setInterval] = useState(String(initial?.interval ?? 1))
  const [nextRunOn, setNextRunOn] = useState(initial?.nextRunOn ?? today)
  const [endOn, setEndOn] = useState(initial?.endOn ?? '')
  const [customerId, setCustomerId] = useState(initial?.customerId ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [lineDescription, setLineDescription] = useState(initial?.lineDescription ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [deferRevenue, setDeferRevenue] = useState(initial?.deferRevenue ?? false)
  const [serviceMonths, setServiceMonths] = useState(String(initial?.serviceMonths ?? 12))
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)

  useEffect(() => {
    if (state.status !== 'success' || handled.current) return
    handled.current = true
    toast.success(state.message ?? 'Saved.')
    router.refresh()
  }, [state, router])

  const e = state.fieldErrors

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="mx-auto max-w-xl space-y-4">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="type" value="INVOICE" />
          <FormStatus state={state} />

          <Field name="name" label="Name" required error={e?.name}>
            <Input
              {...fieldProps('name', e?.name)}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              required
            />
          </Field>

          <Field name="customerId" label="Customer" required error={e?.customerId}>
            <EntityPicker
              name="customerId"
              kind="customer"
              options={customers}
              value={customerId || null}
              onChange={(next) => setCustomerId(next ?? '')}
              placeholder="Choose customer"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="amount" label={`Amount (${currency})`} required error={e?.amount}>
              <Input
                {...fieldProps('amount', e?.amount)}
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(ev) => setAmount(ev.target.value)}
                required
              />
            </Field>
            <Field name="lineDescription" label="Line description" error={e?.lineDescription}>
              <Input
                {...fieldProps('lineDescription', e?.lineDescription)}
                value={lineDescription}
                onChange={(ev) => setLineDescription(ev.target.value)}
                placeholder="Subscription / rental"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="frequency" label="Frequency" error={e?.frequency}>
              <NativeSelect
                {...fieldProps('frequency', e?.frequency)}
                value={frequency}
                onChange={(ev) => setFrequency(ev.target.value as Frequency)}
              >
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {RECURRING_FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field name="interval" label="Every" error={e?.interval}>
              <Input
                {...fieldProps('interval', e?.interval)}
                type="number"
                min={1}
                max={52}
                value={interval}
                onChange={(ev) => setInterval(ev.target.value)}
              />
            </Field>
            <Field name="nextRunOn" label="Next run" error={e?.nextRunOn}>
              <DateField name="nextRunOn" value={nextRunOn} onChange={setNextRunOn} />
            </Field>
          </div>

          <Field name="endOn" label="End on (optional)" error={e?.endOn}>
            <DateField name="endOn" value={endOn} onChange={setEndOn} />
          </Field>

          <Field name="memo" label="Memo" error={e?.memo}>
            <Input
              {...fieldProps('memo', e?.memo)}
              value={memo}
              onChange={(ev) => setMemo(ev.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="deferRevenue"
              checked={deferRevenue}
              onChange={(ev) => setDeferRevenue(ev.target.checked)}
              value="true"
            />
            Defer revenue (unearned → recognize monthly)
          </label>
          {deferRevenue ? (
            <Field name="serviceMonths" label="Service months" error={e?.serviceMonths}>
              <Input
                {...fieldProps('serviceMonths', e?.serviceMonths)}
                type="number"
                min={1}
                max={60}
                value={serviceMonths}
                onChange={(ev) => setServiceMonths(ev.target.value)}
              />
            </Field>
          ) : (
            <input type="hidden" name="serviceMonths" value="" />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              checked={isActive}
              onChange={(ev) => setIsActive(ev.target.checked)}
              value="true"
            />
            Active
          </label>

          <div className="flex gap-2 pt-2">
            <SubmitButton>{mode === 'create' ? 'Save schedule' : 'Update'}</SubmitButton>
            <Button type="button" variant="outline" onClick={() => router.push('/sales/subscriptions')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
