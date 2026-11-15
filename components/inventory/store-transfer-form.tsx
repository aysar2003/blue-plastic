'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { saveStoreTransferForm } from '@/app/(app)/inventory/actions'
import { idleState } from '@/components/forms/action-state'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormChromeToolbar } from '@/components/forms/form-chrome-toolbar'
import { FormStatus } from '@/components/forms/form-status'
import { LockedNumber } from '@/components/forms/locked-number'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { resolveUnit } from '@/lib/quantity'

type StoreOption = { id: string; name: string; isOffice: boolean }
type ItemOption = { id: string; label: string; onHand: string; unitOfMeasure?: string | null }

export function StoreTransferForm({
  stores,
  items,
  today,
  documentNumber,
  initialFromStoreId,
  initialItemId,
  document,
  copiedFromNumber,
}: {
  stores: StoreOption[]
  items: ItemOption[]
  today: string
  documentNumber: string
  initialFromStoreId?: string
  initialItemId?: string
  document?: {
    fromStoreId: string
    toStoreId: string
    itemId: string
    quantity: string
    memo: string | null
  }
  copiedFromNumber?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveStoreTransferForm, idleState)
  const [number, setNumber] = usePropState(documentNumber)
  const [date, setDate] = useState(today)
  const [fromStoreId, setFromStoreId] = useState(
    document?.fromStoreId ?? initialFromStoreId ?? stores[0]?.id ?? '',
  )
  const [toStoreId, setToStoreId] = useState(() => {
    if (document?.toStoreId) return document.toStoreId
    const from = document?.fromStoreId ?? initialFromStoreId ?? stores[0]?.id
    return stores.find((store) => store.id !== from)?.id ?? ''
  })
  const [itemId, setItemId] = useState(document?.itemId ?? initialItemId ?? '')
  const [quantity, setQuantity] = useState(document?.quantity ?? '')
  const [memo, setMemo] = useState(document?.memo ?? '')
  const handled = useRef(false)

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Transferred.')
      router.push(fromStoreId ? `/stores/${fromStoreId}` : '/stores')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, fromStoreId])

  const item = items.find((row) => row.id === itemId)
  const destinations = stores.filter((store) => store.id !== fromStoreId)
  const e = state.fieldErrors

  const canSave = fromStoreId !== '' && toStoreId !== '' && itemId !== '' && quantity !== ''

  return (
    <form action={formAction} className="mx-auto max-w-xl space-y-4">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="fromStoreId" value={fromStoreId} />
      <input type="hidden" name="toStoreId" value={toStoreId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="memo" value={memo} />

      <FormChromeToolbar newHref="/stores/transfer/new" canSave={canSave} />
      {copiedFromNumber ? (
        <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground print:hidden">
          Copy of <span className="font-medium text-foreground">{copiedFromNumber}</span>. Check
          that the source store still has enough stock before saving.
        </p>
      ) : null}

      <Card tone="stock">
        <CardContent className="space-y-4 p-4">
          <FormStatus state={state} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="number" label="Number">
              <LockedNumber label="Number" value={number} onChange={setNumber} />
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

          <Field name="fromStoreId" label="From store" required error={e?.fromStoreId}>
            <NativeSelect
              {...fieldProps('fromStoreId', e?.fromStoreId)}
              value={fromStoreId}
              onChange={(event) => {
                const next = event.target.value
                setFromStoreId(next)
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

          <Field name="itemId" label="Item" required error={e?.itemId}>
            <EntityPicker
              id="itemId"
              kind="item"
              options={items}
              value={itemId || null}
              onChange={(next) => setItemId(next ?? '')}
              placeholder="Choose an item"
              required
              error={e?.itemId}
            />
            {item ? (
              <p className="mt-1 text-xs text-muted-foreground">
                On hand (all stores): {item.onHand}
              </p>
            ) : null}
          </Field>

          <Field
            name="quantity"
            label={item ? `Quantity (${resolveUnit(item.unitOfMeasure)})` : 'Quantity'}
            required
            error={e?.quantity}
          >
            <div className="relative">
              <Input
                {...fieldProps('quantity', e?.quantity)}
                inputMode="decimal"
                className="tabular pr-10"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
              {item ? (
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.65rem] font-medium uppercase text-muted-foreground">
                  {resolveUnit(item.unitOfMeasure)}
                </span>
              ) : null}
            </div>
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
        <SubmitButton pendingLabel="Transferring…">Transfer stock</SubmitButton>
      </div>
    </form>
  )
}
