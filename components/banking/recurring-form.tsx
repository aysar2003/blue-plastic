'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  createRecurringForm,
  updateRecurringForm,
} from '@/app/(app)/banking/recurring/actions'
import { idleState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { AccountPickerOption } from '@/lib/account-options'
import type { PickerOption } from '@/components/forms/entity-picker'
import {
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_LABELS,
  RECURRING_TYPE_LABELS,
  RECURRING_TYPES,
} from '@/lib/validation/recurring'

type DocType = (typeof RECURRING_TYPES)[number]
type Frequency = (typeof RECURRING_FREQUENCIES)[number]

type JournalLine = {
  key: number
  accountId: string
  debit: string
  credit: string
  description: string
}

type Initial = {
  id: string
  name: string
  type: DocType
  frequency: Frequency
  interval: number
  nextRunOn: string
  endOn: string | null
  isActive: boolean
  memo: string
  vendorId: string
  paymentAccountId: string
  expenseAccountId: string
  amount: string
  lineDescription: string
  journalLines: JournalLine[]
}

function blankJournalLines(): JournalLine[] {
  return [
    { key: 1, accountId: '', debit: '', credit: '', description: '' },
    { key: 2, accountId: '', debit: '', credit: '', description: '' },
  ]
}

export function RecurringForm({
  mode,
  today,
  currency,
  vendors,
  expenseAccounts,
  paymentAccounts,
  journalAccounts,
  canJournal,
  canPurchase,
  initial,
}: {
  mode: 'create' | 'edit'
  today: string
  currency: string
  vendors: PickerOption[]
  expenseAccounts: AccountPickerOption[]
  paymentAccounts: AccountPickerOption[]
  journalAccounts: AccountPickerOption[]
  canJournal: boolean
  canPurchase: boolean
  initial?: Initial
}) {
  const router = useRouter()
  const formAction = mode === 'create' ? createRecurringForm : updateRecurringForm
  const [state, action] = useActionState(formAction, idleState)
  const handled = useRef(false)

  const defaultType: DocType = canPurchase ? 'BILL' : 'JOURNAL'
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<DocType>(initial?.type ?? defaultType)
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'MONTHLY')
  const [interval, setInterval] = useState(String(initial?.interval ?? 1))
  const [nextRunOn, setNextRunOn] = useState(initial?.nextRunOn ?? today)
  const [endOn, setEndOn] = useState(initial?.endOn ?? '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? '')
  const [paymentAccountId, setPaymentAccountId] = useState(initial?.paymentAccountId ?? '')
  const [expenseAccountId, setExpenseAccountId] = useState(initial?.expenseAccountId ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [lineDescription, setLineDescription] = useState(initial?.lineDescription ?? '')
  const [journalLines, setJournalLines] = useState<JournalLine[]>(
    initial?.journalLines?.length ? initial.journalLines : blankJournalLines(),
  )
  const nextKey = useRef((initial?.journalLines?.length ?? 2) + 1)

  useEffect(() => {
    if (mode === 'edit' && state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Updated.')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, mode, router])

  const allowedTypes = useMemo(() => {
    return RECURRING_TYPES.filter((t) => (t === 'JOURNAL' ? canJournal : canPurchase))
  }, [canJournal, canPurchase])

  const e = state.fieldErrors
  const isJournal = type === 'JOURNAL'
  const isExpense = type === 'EXPENSE'

  const journalLinesJson = JSON.stringify(
    journalLines
      .filter((line) => line.accountId && (line.debit !== '' || line.credit !== ''))
      .map(({ accountId, debit, credit, description }) => ({
        accountId,
        debit,
        credit,
        description: description || null,
      })),
  )

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
      <input type="hidden" name="journalLinesJson" value={journalLinesJson} />

      <Card>
        <CardContent className="space-y-4 p-4">
          <FormStatus state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Name" required error={e?.name}>
              <Input
                {...fieldProps('name', e?.name)}
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="Office rent"
                required
              />
            </Field>
            <Field name="type" label="Creates" required error={e?.type}>
              <NativeSelect
                id="type"
                name="type"
                value={type}
                onChange={(ev) => setType(ev.target.value as DocType)}
                disabled={mode === 'edit'}
              >
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>
                    {RECURRING_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field name="frequency" label="Repeats" required error={e?.frequency}>
              <NativeSelect
                id="frequency"
                name="frequency"
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
            <Field name="interval" label="Every" required error={e?.interval} hint="1 = every period">
              <Input
                {...fieldProps('interval', e?.interval, true)}
                inputMode="numeric"
                className="tabular"
                value={interval}
                onChange={(ev) => setInterval(ev.target.value)}
                required
              />
            </Field>
            <Field name="nextRunOn" label="Next date" required error={e?.nextRunOn}>
              <DateField
                id="nextRunOn"
                name="nextRunOn"
                value={nextRunOn}
                onChange={setNextRunOn}
                today={today}
                required
              />
            </Field>
            <Field name="endOn" label="Ends on" error={e?.endOn} hint="Optional">
              <DateField
                id="endOn"
                name="endOn"
                value={endOn}
                onChange={setEndOn}
                today={today}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(ev) => setIsActive(ev.target.checked)}
              className="size-4 rounded border-input"
            />
            Active — create when due
          </label>

          <Field name="memo" label="Memo" error={e?.memo}>
            <textarea
              {...fieldProps('memo', e?.memo)}
              value={memo}
              onChange={(ev) => setMemo(ev.target.value)}
              rows={2}
              className="flex min-h-[4rem] w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[0.8125rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </Field>
        </CardContent>
      </Card>

      {isJournal ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">Journal lines</p>
            <p className="text-xs text-muted-foreground">
              Debits and credits must balance. The date is filled when each occurrence is created.
            </p>
            {e?.journalLinesJson?.[0] ? (
              <p role="alert" className="text-xs text-destructive">
                {e.journalLinesJson[0]}
              </p>
            ) : null}
            <div className="space-y-2">
              {journalLines.map((line, index) => (
                <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
                  <AccountPicker
                    id={`jl-account-${line.key}`}
                    options={journalAccounts}
                    value={line.accountId || null}
                    onChange={(next) =>
                      setJournalLines((rows) =>
                        rows.map((r) =>
                          r.key === line.key ? { ...r, accountId: next ?? '' } : r,
                        ),
                      )
                    }
                    placeholder={`Line ${index + 1} account`}
                  />
                  <Input
                    inputMode="decimal"
                    className="tabular"
                    placeholder="Debit"
                    aria-label={`Line ${index + 1} debit`}
                    value={line.debit}
                    onChange={(ev) =>
                      setJournalLines((rows) =>
                        rows.map((r) =>
                          r.key === line.key ? { ...r, debit: ev.target.value, credit: '' } : r,
                        ),
                      )
                    }
                  />
                  <Input
                    inputMode="decimal"
                    className="tabular"
                    placeholder="Credit"
                    aria-label={`Line ${index + 1} credit`}
                    value={line.credit}
                    onChange={(ev) =>
                      setJournalLines((rows) =>
                        rows.map((r) =>
                          r.key === line.key ? { ...r, credit: ev.target.value, debit: '' } : r,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const key = nextKey.current++
                setJournalLines((rows) => [
                  ...rows,
                  { key, accountId: '', debit: '', credit: '', description: '' },
                ])
              }}
            >
              Add line
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <p className="text-sm font-medium">
              {isExpense ? 'Expense details' : 'Bill details'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="vendorId" label="Vendor" required error={e?.vendorId}>
                <EntityPicker
                  id="vendorId"
                  name="vendorId"
                  kind="vendor"
                  options={vendors}
                  value={vendorId || null}
                  onChange={(next) => setVendorId(next ?? '')}
                  placeholder="Choose a vendor"
                  required
                  error={e?.vendorId}
                  currency={currency}
                />
              </Field>
              {isExpense ? (
                <Field
                  name="paymentAccountId"
                  label="Paid from"
                  required
                  error={e?.paymentAccountId}
                >
                  <AccountPicker
                    id="paymentAccountId"
                    name="paymentAccountId"
                    options={paymentAccounts}
                    value={paymentAccountId || null}
                    onChange={(next) => setPaymentAccountId(next ?? '')}
                    required
                    error={e?.paymentAccountId}
                  />
                </Field>
              ) : null}
              <Field
                name="expenseAccountId"
                label="Expense account"
                required
                error={e?.expenseAccountId}
              >
                <AccountPicker
                  id="expenseAccountId"
                  name="expenseAccountId"
                  options={expenseAccounts}
                  value={expenseAccountId || null}
                  onChange={(next) => setExpenseAccountId(next ?? '')}
                  required
                  error={e?.expenseAccountId}
                />
              </Field>
              <Field name="amount" label={`Amount (${currency})`} required error={e?.amount}>
                <Input
                  {...fieldProps('amount', e?.amount)}
                  inputMode="decimal"
                  className="tabular"
                  value={amount}
                  onChange={(ev) => setAmount(ev.target.value)}
                  placeholder="0.00"
                  required
                />
              </Field>
              <Field
                name="lineDescription"
                label="Line description"
                error={e?.lineDescription}
                className="sm:col-span-2"
              >
                <Input
                  {...fieldProps('lineDescription', e?.lineDescription)}
                  value={lineDescription}
                  onChange={(ev) => setLineDescription(ev.target.value)}
                  placeholder={name || 'Description on the bill'}
                />
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Saving…">
          {mode === 'create' ? 'Save template' : 'Save changes'}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => router.push('/banking/recurring')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export type RecurringFormInitial = Initial

/** Narrow a stored payload into form defaults. */
export function initialFromPayload(
  row: {
    id: string
    name: string
    type: DocType
    frequency: Frequency
    interval: number
    nextRunOn: string
    endOn: string | null
    isActive: boolean
    payload: Record<string, unknown>
  },
): Initial {
  const payload = row.payload
  if (row.type === 'JOURNAL') {
    const lines = Array.isArray(payload.lines) ? payload.lines : []
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      frequency: row.frequency,
      interval: row.interval,
      nextRunOn: row.nextRunOn,
      endOn: row.endOn,
      isActive: row.isActive,
      memo: typeof payload.memo === 'string' ? payload.memo : '',
      vendorId: '',
      paymentAccountId: '',
      expenseAccountId: '',
      amount: '',
      lineDescription: '',
      journalLines:
        lines.length > 0
          ? lines.map((line, i) => {
              const l = line as Record<string, unknown>
              return {
                key: i + 1,
                accountId: typeof l.accountId === 'string' ? l.accountId : '',
                debit: typeof l.debit === 'string' ? l.debit : l.debit != null ? String(l.debit) : '',
                credit:
                  typeof l.credit === 'string' ? l.credit : l.credit != null ? String(l.credit) : '',
                description: typeof l.description === 'string' ? l.description : '',
              }
            })
          : blankJournalLines(),
    }
  }

  const lines = Array.isArray(payload.lines) ? payload.lines : []
  const first = (lines[0] ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    frequency: row.frequency,
    interval: row.interval,
    nextRunOn: row.nextRunOn,
    endOn: row.endOn,
    isActive: row.isActive,
    memo: typeof payload.memo === 'string' ? payload.memo : '',
    vendorId: typeof payload.vendorId === 'string' ? payload.vendorId : '',
    paymentAccountId:
      typeof payload.paymentAccountId === 'string' ? payload.paymentAccountId : '',
    expenseAccountId:
      typeof first.expenseAccountId === 'string' ? first.expenseAccountId : '',
    amount:
      typeof first.unitPrice === 'string'
        ? first.unitPrice
        : first.unitPrice != null
          ? String(first.unitPrice)
          : '',
    lineDescription: typeof first.description === 'string' ? first.description : '',
    journalLines: blankJournalLines(),
  }
}
