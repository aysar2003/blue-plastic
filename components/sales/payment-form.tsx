'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { EntityPicker } from '@/components/forms/entity-picker'
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
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate, toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { PAYMENT_METHOD_LABELS } from '@/lib/sales-types'
import { savePaymentForm } from '@/app/(app)/sales/actions'

type OpenInvoice = { id: string; number: string; date: string; dueDate: string | null; balance: string }
type Option = { id: string; label: string }

/**
 * Recording money received.
 *
 * The payment is entered first and applied second, in that order, because that is
 * what actually happened: the money arrived, and then someone decided what it was
 * for. Anything left unapplied stays on the balance sheet as a customer credit
 * rather than being forced onto an invoice it may not belong to.
 */
export function PaymentForm({
  customers,
  depositAccounts,
  today,
  currency,
  loadOpenInvoices,
  initialCustomerId,
  documentNumber,
}: {
  customers: Option[]
  depositAccounts: AccountPickerOption[]
  today: string
  currency: string
  loadOpenInvoices: (customerId: string) => Promise<OpenInvoice[]>
  initialCustomerId?: string
  documentNumber: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(savePaymentForm, idleState)

  const [number, setNumber] = useState(documentNumber)
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [depositAccountId, setDepositAccountId] = useState(depositAccounts[0]?.id ?? '')
  const [reference, setReference] = useState('')
  const [memo, setMemo] = useState('')

  const [invoices, setInvoices] = useState<OpenInvoice[]>([])
  const [applied, setApplied] = useState<Record<string, string>>({})
  const [isLoading, startLoading] = useTransition()
  const handled = useRef(false)

  useEffect(() => setNumber(documentNumber), [documentNumber])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Recorded.')
      router.push('/payments')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  /**
   * Choosing a customer fetches what they still owe. Done in the handler rather
   * than an effect: it is a response to an action, not a synchronisation.
   */
  const chooseCustomer = (id: string) => {
    setCustomerId(id)
    setApplied({})
    if (!id) {
      setInvoices([])
      return
    }
    startLoading(async () => setInvoices(await loadOpenInvoices(id)))
  }

  useEffect(() => {
    if (!initialCustomerId) return
    chooseCustomer(initialCustomerId)
    // The customer arrived on the URL. Load their open invoices once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerId])

  const totals = useMemo(() => {
    const received = parseMoneyInput(amount) ?? ZERO
    const appliedTotal = Object.values(applied).reduce(
      (sum, value) => sum.plus(parseMoneyInput(value) ?? ZERO),
      ZERO,
    )
    return { received, appliedTotal, unapplied: received.minus(appliedTotal) }
  }, [amount, applied])

  /** Oldest first, until the money runs out — how a remittance is usually meant. */
  const autoApply = () => {
    let remaining = parseMoneyInput(amount) ?? ZERO
    const next: Record<string, string> = {}
    for (const invoice of invoices) {
      if (remaining.lessThanOrEqualTo(0)) break
      const balance = new Decimal(invoice.balance)
      const take = Decimal.min(balance, remaining)
      next[invoice.id] = take.toFixed(2)
      remaining = remaining.minus(take)
    }
    setApplied(next)
  }

  const payload = JSON.stringify({
    number,
    customerId,
    date,
    amount,
    method,
    depositAccountId,
    reference,
    memo,
    applications: Object.entries(applied)
      .filter(([, value]) => (parseMoneyInput(value) ?? ZERO).greaterThan(0))
      .map(([invoiceId, value]) => ({ invoiceId, amount: value })),
  })

  const overApplied = totals.unapplied.isNegative()
  const canSave = customerId !== '' && totals.received.greaterThan(0) && !overApplied

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <CardContent className="space-y-4 p-4">
          <FormStatus state={state} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LockedNumber
              label="Payment number"
              value={number}
              onChange={setNumber}
              error={state.fieldErrors?.number}
            />

            <Field name="customerId" label="Customer" required error={state.fieldErrors?.customerId}>
              <EntityPicker
                id="customerId"
                kind="customer"
                options={customers}
                value={customerId || null}
                onChange={(next) => chooseCustomer(next ?? '')}
                placeholder="Search or add a customer"
                required
                error={state.fieldErrors?.customerId}
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

            <Field name="amount" label={`Amount received (${currency})`} required error={state.fieldErrors?.amount}>
              <Input
                {...fieldProps('amount', state.fieldErrors?.amount)}
                inputMode="decimal"
                className="tabular"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            <Field name="method" label="Method" error={state.fieldErrors?.method}>
              <NativeSelect
                {...fieldProps('method', state.fieldErrors?.method)}
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field
              name="depositAccountId"
              label="Deposit to"
              hint="Undeposited Funds if it is in hand but not yet banked."
              required
              error={state.fieldErrors?.depositAccountId}
            >
              <AccountPicker
                id="depositAccountId"
                name="depositAccountId"
                options={depositAccounts}
                value={depositAccountId || null}
                onChange={(next) => setDepositAccountId(next ?? '')}
                required
                error={state.fieldErrors?.depositAccountId}
              />
            </Field>

            <Field name="reference" label="Reference" error={state.fieldErrors?.reference}>
              <Input
                {...fieldProps('reference', state.fieldErrors?.reference)}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Cheque or transfer number"
              />
            </Field>

            <Field name="memo" label="Note" error={state.fieldErrors?.memo}>
              <Input
                {...fieldProps('memo', state.fieldErrors?.memo)}
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {customerId ? (
        <Card className="overflow-hidden p-0">
          <div className="panel-head">
            <span className="text-sm font-semibold">Outstanding invoices</span>
            <Button type="button" variant="outline" size="sm" onClick={autoApply} disabled={invoices.length === 0}>
              Apply oldest first
            </Button>
          </div>

          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nothing outstanding. The payment will sit as an unapplied credit until it is put against an
              invoice — which is where it belongs until someone decides what it was for.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Invoice</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Due</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Outstanding</th>
                  <th className="w-36 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Apply</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="tabular px-3 py-2 font-medium">{invoice.number}</td>
                    <td className="tabular px-3 py-2 text-muted-foreground">
                      {invoice.dueDate ? formatDate(toCalendarDate(new Date(invoice.dueDate))) : '—'}
                    </td>
                    <td className="tabular px-3 py-2 text-right">
                      {formatMoney(invoice.balance, currency)}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Apply to ${invoice.number}`}
                        inputMode="decimal"
                        className="tabular text-right"
                        value={applied[invoice.id] ?? ''}
                        onChange={(event) =>
                          setApplied((current) => ({ ...current, [invoice.id]: event.target.value }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex flex-wrap justify-end gap-8 border-t p-3 text-sm">
            <span>
              <span className="text-muted-foreground">Applied </span>
              <span className="tabular font-medium">{formatMoney(totals.appliedTotal, currency)}</span>
            </span>
            <span className={overApplied ? 'text-destructive' : ''}>
              <span className={overApplied ? '' : 'text-muted-foreground'}>
                {overApplied ? 'Over-applied by ' : 'Unapplied '}
              </span>
              <span className="tabular font-medium">
                {formatMoney(totals.unapplied.abs(), currency)}
              </span>
            </span>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/payments')}>
          Cancel
        </Button>
        <SubmitButton disabled={!canSave} pendingLabel="Recording…">
          Record payment
        </SubmitButton>
      </div>
    </form>
  )
}
