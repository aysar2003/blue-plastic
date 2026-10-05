'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Trash2Icon } from 'lucide-react'
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
import { formatDate, toCalendarDate } from '@/lib/date'
import { formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { saveDepositForm } from '@/app/(app)/banking/actions'

type Payment = {
  id: string
  number: string
  date: string
  amount: string
  customer: string
  reference: string | null
}
type OtherLine = { key: number; accountId: string; description: string; amount: string }

export function DepositForm({
  bankAccounts,
  otherAccounts,
  payments,
  today,
  currency,
  documentNumber,
  defaultBankAccountId,
}: {
  bankAccounts: AccountPickerOption[]
  otherAccounts: AccountPickerOption[]
  payments: Payment[]
  today: string
  currency: string
  documentNumber: string
  defaultBankAccountId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveDepositForm, idleState)

  const [number, setNumber] = useState(documentNumber)
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId && bankAccounts.some((a) => a.id === defaultBankAccountId)
      ? defaultBankAccountId
      : (bankAccounts[0]?.id ?? ''),
  )
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [memo, setMemo] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [otherLines, setOtherLines] = useState<OtherLine[]>([])
  const nextKey = useRef(1)
  const handled = useRef(false)

  useEffect(() => setNumber(documentNumber), [documentNumber])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Recorded.')
      router.push('/banking/accounts')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  const total = useMemo(() => {
    const fromPayments = payments
      .filter((payment) => selected.has(payment.id))
      .reduce((sum, payment) => sum.plus(payment.amount), ZERO)
    const fromOther = otherLines.reduce(
      (sum, line) => sum.plus(parseMoneyInput(line.amount) ?? ZERO),
      ZERO,
    )
    return fromPayments.plus(fromOther)
  }, [payments, selected, otherLines])

  const payload = JSON.stringify({
    number,
    bankAccountId,
    date,
    reference,
    memo,
    paymentIds: [...selected],
    otherLines: otherLines
      .filter((line) => line.accountId && (parseMoneyInput(line.amount) ?? ZERO).greaterThan(0))
      .map((line) => ({ accountId: line.accountId, description: line.description, amount: line.amount })),
  })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormStatus state={state} />

          <LockedNumber
            label="Deposit number"
            value={number}
            onChange={setNumber}
            error={state.fieldErrors?.number}
          />

          <Field name="bankAccountId" label="Deposit to" required error={state.fieldErrors?.bankAccountId}>
            <AccountPicker
              id="bankAccountId"
              name="bankAccountId"
              options={bankAccounts}
              value={bankAccountId || null}
              onChange={(next) => setBankAccountId(next ?? '')}
              required
              error={state.fieldErrors?.bankAccountId}
            />
          </Field>

          <Field name="date" label="Date" required error={state.fieldErrors?.date}>
            <DateField
              id="date"
              value={date}
              onChange={setDate}
              today={today}
              required
              aria-invalid={state.fieldErrors?.date ? true : undefined}
            />
          </Field>

          <Field name="reference" label="Reference" error={state.fieldErrors?.reference}>
            <Input
              {...fieldProps('reference', state.fieldErrors?.reference)}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Paying-in slip number"
            />
          </Field>

          <Field name="memo" label="Note" error={state.fieldErrors?.memo}>
            <Input
              {...fieldProps('memo', state.fieldErrors?.memo)}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="panel-head text-sm font-semibold">
          Payments waiting to be banked
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nothing in Undeposited Funds. Payments received straight into a bank account do not need a
            deposit — they are already there.
          </p>
        ) : (
          <ul className="divide-y">
            {payments.map((payment) => (
              <li key={payment.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selected.has(payment.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (next.has(payment.id)) next.delete(payment.id)
                        else next.add(payment.id)
                        return next
                      })
                    }
                    className="size-4 rounded border-input"
                    aria-label={`Bank ${payment.number}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{payment.customer}</span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="tabular">{payment.number}</span>
                      {' · '}
                      <span className="tabular">{formatDate(toCalendarDate(new Date(payment.date)))}</span>
                      {payment.reference ? ` · ${payment.reference}` : ''}
                    </span>
                  </span>
                  <span className="tabular text-sm font-medium">
                    {formatMoney(payment.amount, currency)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="panel-head text-sm font-semibold">
          Anything else on the slip
        </div>
        {otherLines.length > 0 ? (
          <table className="w-full text-sm">
            <tbody>
              {otherLines.map((line) => (
                <tr key={line.key} className="border-b last:border-0">
                  <td className="w-64 px-2 py-1.5">
                    <AccountPicker
                      options={otherAccounts}
                      value={line.accountId || null}
                      onChange={(next) =>
                        setOtherLines((current) =>
                          current.map((l) => (l.key === line.key ? { ...l, accountId: next ?? '' } : l)),
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label="Description"
                      value={line.description}
                      onChange={(event) =>
                        setOtherLines((current) =>
                          current.map((l) => (l.key === line.key ? { ...l, description: event.target.value } : l)),
                        )
                      }
                    />
                  </td>
                  <td className="w-32 px-2 py-1.5">
                    <Input
                      aria-label="Amount"
                      inputMode="decimal"
                      className="tabular text-right"
                      value={line.amount}
                      onChange={(event) =>
                        setOtherLines((current) =>
                          current.map((l) => (l.key === line.key ? { ...l, amount: event.target.value } : l)),
                        )
                      }
                    />
                  </td>
                  <td className="w-10 px-1 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove line"
                      onClick={() => setOtherLines((current) => current.filter((l) => l.key !== line.key))}
                    >
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setOtherLines((current) => [
                ...current,
                { key: nextKey.current++, accountId: '', description: '', amount: '' },
              ])
            }
          >
            <PlusIcon /> Add a line
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-4">
        <span className="text-sm">
          <span className="text-muted-foreground">Deposit total </span>
          <span className="tabular text-base font-semibold">{formatMoney(total, currency)}</span>
        </span>
        <Button type="button" variant="outline" onClick={() => router.push('/banking/accounts')}>
          Cancel
        </Button>
        <SubmitButton disabled={!total.greaterThan(0) || bankAccountId === ''} pendingLabel="Recording…">
          Record deposit
        </SubmitButton>
      </div>
    </form>
  )
}
