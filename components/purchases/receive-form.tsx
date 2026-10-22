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
import { NativeSelect } from '@/components/ui/native-select'
import { Decimal, formatMoney, parseMoneyInput } from '@/lib/money'
import { formatQty, resolveUnit } from '@/lib/quantity'
import { officeStoreId, type StoreChoice } from '@/lib/store-stock'
import { cn } from '@/lib/utils'
import { receiveOrderForm } from '@/app/(app)/purchases/actions'
import type { ReceivableLine } from '@/server/services/purchase.service'

/** Initial shelf for one line: preferred pick, else the order's store, else office. */
function lineStoreDefault(
  line: ReceivableLine,
  stores: StoreChoice[],
  preferredStoreId?: string | null,
): string {
  if (preferredStoreId && stores.some((store) => store.id === preferredStoreId)) {
    return preferredStoreId
  }
  if (line.storeId && stores.some((store) => store.id === line.storeId)) {
    return line.storeId
  }
  return officeStoreId(stores)
}

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
 *
 * Each tracked line picks its own store, so one receipt can put two items on
 * two different shelves when that is how the delivery landed.
 */
export function ReceiveForm({
  orderId,
  orderNumber,
  vendorName,
  lines,
  today,
  currency,
  stores = [],
  preferredStoreId = null,
}: {
  orderId: string
  orderNumber: string
  vendorName: string
  lines: ReceivableLine[]
  today: string
  currency: string
  stores?: StoreChoice[]
  preferredStoreId?: string | null
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(receiveOrderForm, idleState)
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [storeByLine, setStoreByLine] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [line.lineId, lineStoreDefault(line, stores, preferredStoreId)]),
    ),
  )
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const handled = useRef(false)
  const showStores = stores.length > 0

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
      .map((line) => ({
        lineId: line.lineId,
        quantity: quantities[line.lineId] ?? '0',
        storeId: showStores ? (storeByLine[line.lineId] ?? '') : '',
      }))
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

  const valueColSpan = showStores ? 6 : 5

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
            price on the order
            {showStores
              ? ', each line to the store you pick for it'
              : ''}
            , and {orderNumber} closes once nothing is outstanding.
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
                {showStores ? (
                  <th className="w-40 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Store
                  </th>
                ) : null}
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
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">
                      {formatQty(line.ordered, line.unitOfMeasure)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">
                      {formatQty(line.received, line.unitOfMeasure)}
                    </td>
                    <td className="tabular px-3 py-2 text-right font-medium">
                      {done ? (
                        <Badge variant="secondary">complete</Badge>
                      ) : (
                        formatQty(line.remaining, line.unitOfMeasure)
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="relative">
                        <Input
                          aria-label={`Quantity received for ${line.itemName ?? line.description ?? 'line'} (${resolveUnit(line.unitOfMeasure)})`}
                          inputMode="decimal"
                          className={cn('tabular pr-10 text-right', over && 'border-destructive')}
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
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.65rem] font-medium uppercase text-muted-foreground">
                          {resolveUnit(line.unitOfMeasure)}
                        </span>
                      </div>
                      {over ? (
                        <span className="mt-1 block px-1 text-xs text-destructive">
                          Only {formatQty(line.remaining, line.unitOfMeasure)} is outstanding
                        </span>
                      ) : null}
                    </td>
                    {showStores ? (
                      <td className="px-2 py-1.5">
                        {line.isTracked && !done ? (
                          <NativeSelect
                            aria-label={`Store for ${line.itemName ?? line.description ?? 'line'}`}
                            value={storeByLine[line.lineId] ?? ''}
                            onChange={(event) =>
                              setStoreByLine((current) => ({
                                ...current,
                                [line.lineId]: event.target.value,
                              }))
                            }
                            className="h-8 text-xs"
                          >
                            {stores.map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.name}
                                {store.isOffice ? ' (office)' : ''}
                              </option>
                            ))}
                          </NativeSelect>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    ) : null}
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
                <td className="px-3 py-2" colSpan={valueColSpan}>
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
