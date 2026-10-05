'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { saveStoreTicketForm } from '@/app/(app)/inventory/actions'
import { idleState } from '@/components/forms/action-state'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { LockedNumber } from '@/components/forms/locked-number'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { StockByStore } from '@/lib/store-stock'

type StoreOption = { id: string; name: string; isOffice: boolean }
type ItemOption = { id: string; label: string; onHand: string }

type Line = { key: number; itemId: string; quantity: string }

export function StoreTicketForm({
  stores,
  items,
  stock = {},
  today,
  documentNumber,
  initialStoreId,
  initialItemId,
}: {
  stores: StoreOption[]
  items: ItemOption[]
  /** Quantity of each item in each store — used for “in this store” hints. */
  stock?: StockByStore
  today: string
  documentNumber: string
  initialStoreId?: string
  initialItemId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveStoreTicketForm, idleState)
  const [number, setNumber] = useState(documentNumber)
  const [date, setDate] = useState(today)
  const [storeId, setStoreId] = useState(initialStoreId ?? stores[0]?.id ?? '')
  const [toStoreId, setToStoreId] = useState(
    stores.find((store) => store.id !== (initialStoreId ?? stores[0]?.id))?.id ?? '',
  )
  const [lines, setLines] = useState<Line[]>([
    { key: 1, itemId: initialItemId ?? '', quantity: '' },
  ])
  const [takenBy, setTakenBy] = useState('')
  const [memo, setMemo] = useState('')
  const nextKey = useRef(2)
  const handled = useRef(false)

  useEffect(() => setNumber(documentNumber), [documentNumber])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Ticket posted.')
      router.push(storeId ? `/stores/${storeId}` : '/stores')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, storeId])

  const destinations = stores.filter((store) => store.id !== storeId)
  const e = state.fieldErrors

  const payload = useMemo(
    () =>
      JSON.stringify({
        number,
        date,
        storeId,
        toStoreId,
        takenBy: takenBy.trim() || null,
        memo: memo.trim() || null,
        lines: lines
          .filter((line) => line.itemId && line.quantity.trim() !== '')
          .map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      }),
    [number, date, storeId, toStoreId, takenBy, memo, lines],
  )

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((current) => [...current, { key: nextKey.current++, itemId: '', quantity: '' }])
  }

  function removeLine(key: number) {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)))
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Card tone="stock">
        <CardContent className="space-y-4 p-4">
          <FormStatus state={state} />
          <p className="text-sm text-muted-foreground">
            Ticket for goods leaving a store. Add as many items as you need — each line gets a
            ticket number and stock moves to the destination store.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="number" label="First ticket number">
              <LockedNumber label="Ticket number" value={number} onChange={setNumber} />
            </Field>
            <Field name="date" label="Date" required error={e?.date}>
              <DateField
                id="date"
                value={date}
                onChange={setDate}
                today={today}
                required
                aria-invalid={e?.date ? true : undefined}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="storeId" label="From store" required error={e?.storeId}>
              <NativeSelect
                {...fieldProps('storeId', e?.storeId)}
                value={storeId}
                onChange={(event) => {
                  const next = event.target.value
                  setStoreId(next)
                  if (toStoreId === next) {
                    setToStoreId(stores.find((store) => store.id !== next)?.id ?? '')
                  }
                }}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                    {store.isOffice ? ' (Office)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field name="toStoreId" label="To store" required error={e?.toStoreId}>
              <NativeSelect
                {...fieldProps('toStoreId', e?.toStoreId)}
                value={toStoreId}
                onChange={(event) => setToStoreId(event.target.value)}
              >
                <option value="">Choose a store…</option>
                {destinations.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                    {store.isOffice ? ' (Office)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Items</h2>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <PlusIcon /> Add item
              </Button>
            </div>
            {e?.lines?.[0] ? <p className="text-sm text-destructive">{e.lines[0]}</p> : null}

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ledger-head text-left text-[0.7rem] font-semibold uppercase tracking-wide">
                    <th className="px-3 py-2">Item</th>
                    <th className="w-28 px-3 py-2 text-right">In store</th>
                    <th className="w-32 px-3 py-2 text-right">Qty</th>
                    <th className="w-12 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const item = items.find((row) => row.id === line.itemId)
                    const inStore = line.itemId
                      ? (stock[line.itemId]?.[storeId] ?? '0.00')
                      : null
                    const lineItemError = e?.[`lines.${index}.itemId`] ?? e?.[`lines[${index}].itemId`]
                    const lineQtyError = e?.[`lines.${index}.quantity`] ?? e?.[`lines[${index}].quantity`]

                    return (
                      <tr key={line.key} className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}>
                        <td className="px-3 py-2 align-top">
                          <EntityPicker
                            id={`item-${line.key}`}
                            kind="item"
                            options={items}
                            value={line.itemId || null}
                            onChange={(next) => updateLine(line.key, { itemId: next ?? '' })}
                            placeholder="Choose an item"
                            required
                            error={lineItemError}
                          />
                          {item && !inStore ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              On hand (all stores): {item.onHand}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right align-middle tabular text-muted-foreground">
                          {inStore ?? '—'}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            inputMode="decimal"
                            className="tabular text-right"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            placeholder="0"
                            aria-invalid={lineQtyError ? true : undefined}
                          />
                          {lineQtyError ? (
                            <p className="mt-1 text-xs text-destructive">{lineQtyError[0]}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Remove line"
                            disabled={lines.length <= 1}
                            onClick={() => removeLine(line.key)}
                          >
                            <Trash2Icon />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Field name="takenBy" label="Taken by" hint="Who collected the goods from this store.">
            <Input
              {...fieldProps('takenBy', e?.takenBy)}
              value={takenBy}
              onChange={(event) => setTakenBy(event.target.value)}
              placeholder="Name"
            />
          </Field>

          <Field name="memo" label="Memo" error={e?.memo}>
            <Input
              {...fieldProps('memo', e?.memo)}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Optional note"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Posting…">Post ticket</SubmitButton>
      </div>
    </form>
  )
}
