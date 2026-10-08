'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheckIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { Decimal, formatMoney, parseMoneyInput } from '@/lib/money'
import { cn } from '@/lib/utils'
import { receiveOrderForm } from '@/app/(app)/purchases/actions'
import type { ReceivableLine } from '@/server/services/purchase.service'

/**
 * Receiving a delivery against a purchase order.
 *
 * Every line on the order is here, with what was ordered, what has already
 * arrived, and what is still to come — and one box to type into: how many
 * arrived today. That is the whole form, because that is the whole decision.
 *
 * What it replaces is a single "Receive and bill" button that turned the entire
 * order into a bill whether or not the entire order had turned up. There was no
 * way to say "three of the ten came" without editing the order first, so people
 * either billed for goods that were not there or recorded nothing at all.
 *
 * "Receive everything outstanding" is still one click, because most deliveries
 * are complete and making the common case take longer is not an improvement.
 */
export function ReceiveForm({
  orderId,
  orderNumber,
  vendorName,
  lines,
  today,
  currency,
}: {
  orderId: string
  orderNumber: string
  vendorName: string
  lines: ReceivableLine[]
  today: string
  currency: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(receiveOrderForm, idleState)
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Receipt recorded.')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router])

  const outstanding = lines.filter((line) => !new Decimal(line.remaining).isZero())

  const totals = useMemo(() => {
    let value = new Decimal(0)
    let count = 0
    for (const line of lines) {
      const quantity = parseMoneyInput(quantities[line.lineId] ?? '')
      if (!quantity || quantity.isZero()) continue
      count += 1
      value = value.plus(quantity.times(line.unitPrice))
    }
    return { value, count }
  }, [lines, quantities])

  const overReceived = lines.some((line) => {
    const quantity = parseMoneyInput(quantities[line.lineId] ?? '')
    return quantity ? quantity.greaterThan(line.remaining) : false
  })

  const receiveAll = () =>
    setQuantities(
      Object.fromEntries(outstanding.map((line) => [line.lineId, line.remaining])),
    )

  const payload = JSON.stringify({
    orderId,
    date,
    reference,
    lines: lines
      .map((line) => ({ lineId: line.lineId, quantity: quantities[line.lineId] ?? '0' }))
      .filter((line) => line.quantity !== '' && Number(line.quantity) > 0),
  })

  if (outstanding.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Everything on {orderNumber} has been received. There is nothing left to book in.
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <FormStatus state={state} />

          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <Field
              name="date"
              label="Date received"
              required
              error={state.fieldErrors?.date}
            >
              <DateField id="date" value={date} onChange={setDate} today={today} required />
            </Field>

            <Field
              name="reference"
              label="Delivery note or vendor reference"
              hint="What to quote if the delivery is ever queried. It goes onto the bill this raises."
              error={state.fieldErrors?.reference}
            >
              <Input
                {...fieldProps('reference', state.fieldErrors?.reference)}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="DN-4471"
              />
            </Field>
          </div>

          <p className="text-sm text-muted-foreground">
            Receiving raises a bill to {vendorName} for what arrived. Tracked stock goes in at the
            price on the order, and {orderNumber} closes once nothing is outstanding.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Ordered</th>
                <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Already in
                </th>
                <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Outstanding
                </th>
                <th className="w-32 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Receiving now
                </th>
                <th className="w-32 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const remaining = new Decimal(line.remaining)
                const entered = parseMoneyInput(quantities[line.lineId] ?? '')
                const over = entered ? entered.greaterThan(remaining) : false
                const done = remaining.isZero()

                return (
                  <tr key={line.lineId} className={cn('border-b last:border-0', done && 'opacity-55')}>
                    <td className="px-3 py-2">
                      <span className="block font-medium">
                        {line.itemName ?? line.description ?? 'Line'}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {line.sku ? `${line.sku} · ` : ''}
                        {formatMoney(line.unitPrice, currency)} each
                        {line.isTracked ? '' : ' · not stock-tracked'}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">{line.ordered}</td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">{line.received}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">
                      {done ? <Badge variant="secondary">complete</Badge> : line.remaining}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Quantity received for ${line.itemName ?? line.description ?? 'line'}`}
                        inputMode="decimal"
                        className={cn('tabular text-right', over && 'border-destructive')}
                        disabled={done}
                        value={quantities[line.lineId] ?? ''}
                        placeholder={done ? '' : '0'}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [line.lineId]: event.target.value,
                          }))
                        }
                      />
                      {over ? (
                        <span className="mt-1 block px-1 text-xs text-destructive">
                          Only {line.remaining} is outstanding
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">
                      {entered && !entered.isZero()
                        ? formatMoney(entered.times(line.unitPrice), currency)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={5}>
                  {totals.count === 0
                    ? 'Nothing entered yet'
                    : `${totals.count} line${totals.count === 1 ? '' : 's'} on this receipt`}
                </td>
                <td className="tabular px-3 py-2 text-right">{formatMoney(totals.value, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <Button type="button" variant="outline" size="sm" onClick={receiveAll}>
            <PackageCheckIcon /> Receive everything outstanding
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQuantities({})}
            disabled={totals.count === 0}
          >
            Clear
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/purchases/purchase-orders/${orderId}`)}
        >
          Cancel
        </Button>
        <SubmitButton disabled={totals.count === 0 || overReceived} pendingLabel="Receiving…">
          Receive and bill
        </SubmitButton>
      </div>
    </form>
  )
}
