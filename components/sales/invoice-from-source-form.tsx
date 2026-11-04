'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { invoiceFromSourceForm } from '@/app/(app)/sales/actions'
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
import { fixed2, formatQty, resolveUnit } from '@/lib/quantity'
import { byType } from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import type { InvoiceableLine } from '@/server/services/sales.service'
import type { SalesDocumentType } from '@prisma/client'

/**
 * Invoicing part of an estimate, quotation, or sales order.
 *
 * The mirror of receiving a purchase order: every line is here, with what was
 * agreed, what has already been billed, and what is still open — and one box
 * for how much to invoice today.
 */
export function InvoiceFromSourceForm({
  sourceId,
  sourceNumber,
  sourceType,
  customerName,
  lines,
  today,
  currency,
}: {
  sourceId: string
  sourceNumber: string
  sourceType: SalesDocumentType
  customerName: string
  lines: InvoiceableLine[]
  today: string
  currency: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(invoiceFromSourceForm, idleState)
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const handled = useRef(false)
  const slug = byType(sourceType).slug

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Invoice created.')
      if (state.created?.id) router.push(`/sales/invoices/${state.created.id}`)
      else router.refresh()
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

  const overBilled = lines.some((line) => {
    const quantity = parseMoneyInput(quantities[line.lineId] ?? '')
    return quantity ? quantity.greaterThan(line.remaining) : false
  })

  const invoiceAll = () =>
    setQuantities(Object.fromEntries(outstanding.map((line) => [line.lineId, line.remaining])))

  const payload = JSON.stringify({
    sourceId,
    date,
    reference,
    lines: lines
      .map((line) => ({
        lineId: line.lineId,
        quantity: quantities[line.lineId] ?? '0',
      }))
      .filter((line) => line.quantity !== '' && Number(line.quantity) > 0),
  })

  if (outstanding.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Everything on {sourceNumber} has been invoiced. There is nothing left to bill.
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
            <Field name="date" label="Invoice date" required error={state.fieldErrors?.date}>
              <DateField id="date" value={date} onChange={setDate} today={today} required />
            </Field>

            <Field
              name="reference"
              label="Reference"
              hint="Copied onto the invoice. Leave blank to keep the source reference."
              error={state.fieldErrors?.reference}
            >
              <Input
                {...fieldProps('reference', state.fieldErrors?.reference)}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          <p className="text-sm text-muted-foreground">
            This raises an invoice to {customerName} for the quantities entered. {sourceNumber} stays
            open until nothing is left to bill.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Agreed</th>
                <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Already billed
                </th>
                <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Outstanding
                </th>
                <th className="w-32 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Invoicing now
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
                      <span className="block font-medium">{line.itemName ?? line.description ?? 'Line'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {line.sku ? `${line.sku} · ` : ''}
                        {formatMoney(line.unitPrice, currency)} each
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">
                      {formatQty(line.ordered, line.unitOfMeasure)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">
                      {formatQty(line.invoiced, line.unitOfMeasure)}
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
                          aria-label={`Quantity to invoice for ${line.itemName ?? line.description ?? 'line'} (${resolveUnit(line.unitOfMeasure)})`}
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
                          onBlur={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [line.lineId]: fixed2(event.target.value),
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
                    : `${totals.count} line${totals.count === 1 ? '' : 's'} on this invoice`}
                </td>
                <td className="tabular px-3 py-2 text-right">{formatMoney(totals.value, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <Button type="button" variant="outline" size="sm" onClick={invoiceAll}>
            <FileCheck2Icon /> Invoice everything outstanding
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
        <Button type="button" variant="outline" onClick={() => router.push(`/sales/${slug}/${sourceId}`)}>
          Cancel
        </Button>
        <SubmitButton disabled={totals.count === 0 || overBilled} pendingLabel="Creating invoice…">
          Create invoice
        </SubmitButton>
      </div>
    </form>
  )
}
