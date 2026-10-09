'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, TicketPercentIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { LockedNumber } from '@/components/forms/locked-number'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { balanceOf, type AccountPickerOption } from '@/lib/account-options'
import { formatDate, toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { PAYMENT_METHOD_LABELS } from '@/lib/sales-types'
import { applyVendorCredit, saveBillPaymentForm } from '@/app/(app)/purchases/actions'

export type OpenBill = {
  id: string
  number: string
  reference: string | null
  date: string
  dueDate: string | null
  total: string
  paid: string
  balance: string
  daysOverdue: number
}

export type OpenCredit = {
  id: string
  number: string
  date: string
  remaining: string
}

export type Payables = { bills: OpenBill[]; credits: OpenCredit[] }

type Option = { id: string; label: string }

/**
 * Paying bills.
 *
 * The screen follows the order the work is actually done in: pick the vendor,
 * see what is owed, tick what is being settled, say where the money comes from.
 * Batch payment is the normal case rather than a special one — on pay day
 * somebody settles several bills from one bank transfer — so ticking a bill
 * fills in its full balance and the payment total follows what has been ticked.
 *
 * Two things the previous version did not show, and both of them are what
 * somebody is actually deciding:
 *
 *   **What is left after this payment.** Paying part of a bill is normal, and
 *   the question is always "and then how much is still owed?". That column is
 *   now there, updating as the amount is typed.
 *
 *   **What is in the account.** The balance sits next to the account, because
 *   "pay all" against an account holding less than the total is a decision, and
 *   it should be visible before the button rather than after the bounce.
 *
 * Vendor credits are shown alongside. A credit is the other way of settling a
 * bill, and one nobody can see is one nobody uses.
 */
export function BillPaymentForm({
  vendors,
  paymentAccounts,
  today,
  currency,
  loadPayables,
  documentNumber,
  initialVendorId,
}: {
  vendors: Option[]
  paymentAccounts: AccountPickerOption[]
  today: string
  currency: string
  loadPayables: (vendorId: string) => Promise<Payables>
  documentNumber: string
  /** Set when a vendor page opened this form, so the vendor and their open bills load at once. */
  initialVendorId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveBillPaymentForm, idleState)

  const [number, setNumber] = usePropState(documentNumber)
  const [vendorId, setVendorId] = useState(initialVendorId ?? '')
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [paymentAccountId, setPaymentAccountId] = useState(paymentAccounts[0]?.id ?? '')
  const [reference, setReference] = useState('')
  const [memo, setMemo] = useState('')

  const [bills, setBills] = useState<OpenBill[]>([])
  const [credits, setCredits] = useState<OpenCredit[]>([])
  const [applied, setApplied] = useState<Record<string, string>>({})
  const [isLoading, startLoading] = useTransition()
  const [isApplyingCredit, startCreditApply] = useTransition()
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Recorded.')
      router.push('/bill-payments')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  const refresh = (id: string) =>
    startLoading(async () => {
      const payables = await loadPayables(id)
      setBills(payables.bills)
      setCredits(payables.credits)
    })

  useEffect(() => {
    if (!initialVendorId) return
    refresh(initialVendorId)
    // The vendor page already chose who is being paid. Load their open bills once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseVendor = (id: string) => {
    setVendorId(id)
    setApplied({})
    if (!id) {
      setBills([])
      setCredits([])
      return
    }
    refresh(id)
  }

  const amountFor = (billId: string) => parseMoneyInput(applied[billId] ?? '') ?? ZERO

  const appliedTotal = useMemo(
    () => bills.reduce((sum, bill) => sum.plus(amountFor(bill.id)), ZERO),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applied, bills],
  )

  const totalOwed = useMemo(
    () => bills.reduce((sum, bill) => sum.plus(new Decimal(bill.balance)), ZERO),
    [bills],
  )

  /** Ticking a bill pays it in full; unticking clears the amount. */
  const toggle = (bill: OpenBill, checked: boolean) =>
    setApplied((current) => ({
      ...current,
      [bill.id]: checked ? new Decimal(bill.balance).toFixed(2) : '',
    }))

  const payAll = () =>
    setApplied(
      Object.fromEntries(bills.map((bill) => [bill.id, new Decimal(bill.balance).toFixed(2)])),
    )

  const clearAll = () => setApplied({})

  const account = paymentAccounts.find((option) => option.id === paymentAccountId)
  const accountBalanceText = account ? balanceOf(account) : null
  const accountBalance = accountBalanceText ? parseMoneyInput(accountBalanceText) : null
  const overdrawn = accountBalance ? appliedTotal.greaterThan(accountBalance) : false

  const overApplied = bills.some((bill) => amountFor(bill.id).greaterThan(new Decimal(bill.balance)))

  const payload = JSON.stringify({
    number,
    vendorId,
    date,
    // The payment is exactly what is being settled: batch payment is the point.
    amount: appliedTotal.toFixed(2),
    method,
    paymentAccountId,
    reference,
    memo,
    applications: bills
      .filter((bill) => amountFor(bill.id).greaterThan(0))
      .map((bill) => ({ billId: bill.id, amount: amountFor(bill.id).toFixed(2) })),
  })

  const canSave =
    vendorId !== '' && paymentAccountId !== '' && appliedTotal.greaterThan(0) && !overApplied

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <FormStatus state={state} />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <LockedNumber
              label="Payment number"
              value={number}
              onChange={setNumber}
              error={state.fieldErrors?.number}
            />

            <Field name="vendorId" label="Vendor" required error={state.fieldErrors?.vendorId}>
              <EntityPicker
                id="vendorId"
                kind="vendor"
                options={vendors}
                value={vendorId || null}
                onChange={(next) => chooseVendor(next ?? '')}
                placeholder="Search or add a vendor"
                required
                error={state.fieldErrors?.vendorId}
              />
            </Field>

            <Field name="date" label="Payment date" required error={state.fieldErrors?.date}>
              <DateField
                id="date"
                value={date}
                onChange={setDate}
                today={today}
                required
                aria-invalid={state.fieldErrors?.date ? true : undefined}
              />
            </Field>

            <Field
              name="paymentAccountId"
              label="Paid from"
              required
              error={state.fieldErrors?.paymentAccountId}
              hint={
                account
                  ? `${account.label} holds ${formatMoney(accountBalance ?? ZERO, currency)}`
                  : undefined
              }
            >
              <AccountPicker
                id="paymentAccountId"
                options={paymentAccounts}
                value={paymentAccountId || null}
                onChange={(next) => setPaymentAccountId(next ?? '')}
                required
                error={state.fieldErrors?.paymentAccountId}
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

          {overdrawn ? (
            <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs text-muted-foreground">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>
                This pays {formatMoney(appliedTotal, currency)} out of an account the books say holds{' '}
                {formatMoney(accountBalance ?? ZERO, currency)}. That is allowed — the ledger records
                what happened, not what should have — but it is worth a second look.
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {vendorId ? (
        <Card className="overflow-hidden p-0">
          <div className="panel-head">
            <span className="text-sm font-semibold">
              Outstanding bills
              {bills.length > 0 ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {formatMoney(totalOwed, currency)} owed
                </span>
              ) : null}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={appliedTotal.isZero()}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={payAll}
                disabled={bills.length === 0}
              >
                Pay all
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : bills.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing outstanding for this vendor.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Bill</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Their ref
                    </th>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Due
                    </th>
                    <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Bill total
                    </th>
                    <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Owing
                    </th>
                    <th className="w-36 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Payment
                    </th>
                    <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Left after
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const balance = new Decimal(bill.balance)
                    const paying = amountFor(bill.id)
                    const remaining = balance.minus(paying)
                    const tooMuch = paying.greaterThan(balance)

                    return (
                      <tr key={bill.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Pay ${bill.number}`}
                            className="size-4 accent-primary"
                            checked={paying.greaterThan(0)}
                            onChange={(event) => toggle(bill, event.target.checked)}
                          />
                        </td>
                        <td className="tabular px-3 py-2 font-medium">
                          {bill.number}
                          {bill.daysOverdue > 0 ? (
                            <span className="ml-2 text-xs font-normal text-destructive">
                              {bill.daysOverdue} days overdue
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{bill.reference ?? '—'}</td>
                        <td className="tabular px-3 py-2 text-muted-foreground">
                          {bill.dueDate ? formatDate(toCalendarDate(new Date(bill.dueDate))) : '—'}
                        </td>
                        <td className="tabular px-3 py-2 text-right text-muted-foreground">
                          {formatMoney(bill.total, currency)}
                        </td>
                        <td className="tabular px-3 py-2 text-right">
                          {formatMoney(bill.balance, currency)}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            aria-label={`Amount to pay ${bill.number}`}
                            inputMode="decimal"
                            className="tabular text-right"
                            aria-invalid={tooMuch ? true : undefined}
                            value={applied[bill.id] ?? ''}
                            onChange={(event) =>
                              setApplied((current) => ({ ...current, [bill.id]: event.target.value }))
                            }
                          />
                        </td>
                        <td
                          className={`tabular px-3 py-2 text-right ${
                            tooMuch ? 'font-medium text-destructive' : 'text-muted-foreground'
                          }`}
                        >
                          {formatMoney(remaining, currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-6 border-t p-3 text-sm">
            <span>
              <span className="text-muted-foreground">Owed </span>
              <span className="tabular font-medium">{formatMoney(totalOwed, currency)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Paying </span>
              <span className="tabular text-base font-semibold">
                {formatMoney(appliedTotal, currency)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">Still owed after this </span>
              <span className="tabular font-medium">
                {formatMoney(totalOwed.minus(appliedTotal), currency)}
              </span>
            </span>
          </div>

          {overApplied ? (
            <p className="border-t bg-destructive/8 px-3 py-2 text-sm text-destructive">
              One of the amounts is more than the bill still owes. A payment cannot settle more than
              exists — reduce it, or record the excess as a separate payment on account.
            </p>
          ) : null}
        </Card>
      ) : null}

      {vendorId && credits.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="panel-head">
            <TicketPercentIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Credits from this vendor</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {credits.map((credit) => (
                <tr key={credit.id} className="border-b last:border-0">
                  <td className="tabular px-3 py-2 font-medium">{credit.number}</td>
                  <td className="tabular px-3 py-2 text-muted-foreground">
                    {formatDate(toCalendarDate(new Date(credit.date)))}
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {formatMoney(credit.remaining, currency)} available
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isApplyingCredit || bills.length === 0}
                      onClick={() =>
                        startCreditApply(async () => {
                          // Oldest bill first, which is the order they are
                          // settled in and the order the list is already in.
                          let left = new Decimal(credit.remaining)
                          const applications: { billId: string; amount: string }[] = []

                          for (const bill of bills) {
                            if (!left.greaterThan(0)) break
                            const take = Decimal.min(left, new Decimal(bill.balance))
                            if (!take.greaterThan(0)) continue
                            applications.push({ billId: bill.id, amount: take.toFixed(2) })
                            left = left.minus(take)
                          }

                          if (applications.length === 0) {
                            toast.error('There is nothing outstanding to put this credit against.')
                            return
                          }

                          const result = await applyVendorCredit({
                            creditDocumentId: credit.id,
                            applications,
                          })

                          if (result.ok) {
                            toast.success(`${credit.number} applied.`)
                            setApplied({})
                            refresh(vendorId)
                            router.refresh()
                          } else {
                            toast.error(result.error.message)
                          }
                        })
                      }
                    >
                      Apply to oldest
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/bill-payments')}>
          Cancel
        </Button>
        <SubmitButton disabled={!canSave} pendingLabel="Paying…">
          Pay {formatMoney(appliedTotal, currency)}
        </SubmitButton>
      </div>
    </form>
  )
}
