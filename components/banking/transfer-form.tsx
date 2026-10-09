'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { LockedNumber } from '@/components/forms/locked-number'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import type { AccountPickerOption } from '@/lib/account-options'
import { saveTransferForm } from '@/app/(app)/banking/actions'

export function TransferForm({
  accounts,
  today,
  currency,
  documentNumber,
  defaultFromAccountId,
}: {
  accounts: AccountPickerOption[]
  today: string
  currency: string
  documentNumber: string
  /** Pre-select the account money leaves (e.g. from the account ⋯ menu). */
  defaultFromAccountId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveTransferForm, idleState)
  const [number, setNumber] = usePropState(documentNumber)
  const [date, setDate] = useState(today)
  const initialFrom =
    (defaultFromAccountId && accounts.some((a) => a.id === defaultFromAccountId)
      ? defaultFromAccountId
      : accounts[0]?.id) ?? ''
  const [fromAccountId, setFrom] = useState(initialFrom)
  const [toAccountId, setTo] = useState(
    () => accounts.find((a) => a.id !== initialFrom)?.id ?? accounts[1]?.id ?? '',
  )
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Recorded.')
      router.push('/banking/accounts')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  const e = state.fieldErrors
  const sameAccount = fromAccountId !== '' && fromAccountId === toAccountId

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4 p-4">
          <FormStatus state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="fromAccountId" label="From" required error={e?.fromAccountId}>
              <AccountPicker
                id="fromAccountId"
                name="fromAccountId"
                options={accounts}
                value={fromAccountId || null}
                onChange={(next) => setFrom(next ?? '')}
                required
                error={e?.fromAccountId}
              />
            </Field>

            <Field
              name="toAccountId"
              label="To"
              required
              error={sameAccount ? ['A transfer to itself moves nothing'] : e?.toAccountId}
            >
              <AccountPicker
                id="toAccountId"
                name="toAccountId"
                options={accounts}
                value={toAccountId || null}
                onChange={(next) => setTo(next ?? '')}
                required
                error={sameAccount ? ['x'] : e?.toAccountId}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <LockedNumber
              label="Transfer number"
              value={number}
              onChange={setNumber}
              error={e?.number}
            />
            <Field name="date" label="Date" required error={e?.date}>
              <DateField id="date" name="date" value={date} onChange={setDate} today={today} required />
            </Field>
            <Field name="amount" label={`Amount (${currency})`} required error={e?.amount}>
              <Input
                {...fieldProps('amount', e?.amount)}
                inputMode="decimal"
                className="tabular"
                placeholder="0.00"
                required
              />
            </Field>
            <Field name="reference" label="Reference" error={e?.reference}>
              <Input {...fieldProps('reference', e?.reference)} />
            </Field>
          </div>

          <Field name="memo" label="Note" error={e?.memo}>
            <Input {...fieldProps('memo', e?.memo)} />
          </Field>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/banking/accounts')}>
          Cancel
        </Button>
        <SubmitButton disabled={sameAccount} pendingLabel="Recording…">
          Record transfer
        </SubmitButton>
      </div>
    </form>
  )
}
