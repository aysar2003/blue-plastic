'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { saveStoreTransferForm } from '@/app/(app)/inventory/actions'
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

type StoreOption = { id: string; name: string; isOffice: boolean }
type ItemOption = { id: string; label: string; onHand: string }

export function StoreTransferForm({
  stores,
  items,
  today,
  documentNumber,
  initialFromStoreId,
  initialItemId,
}: {
  stores: StoreOption[]
  items: ItemOption[]
  today: string
  documentNumber: string
  initialFromStoreId?: string
  initialItemId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveStoreTransferForm, idleState)
  const [number, setNumber] = useState(documentNumber)
  const [date, setDate] = useState(today)
  const [fromStoreId, setFromStoreId] = useState(initialFromStoreId ?? stores[0]?.id ?? '')
  const [toStoreId, setToStoreId] = useState(
    stores.find((store) => store.id !== (initialFromStoreId ?? stores[0]?.id))?.id ?? '',
  )
  const [itemId, setItemId] = useState(initialItemId ?? '')
  const [quantity, setQuantity] = useState('')
  const [memo, setMemo] = useState('')
  const handled = useRef(false)

  useEffect(() => setNumber(documentNumber), [documentNumber])

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

  return (
    <form action={formAction} className="mx-auto max-w-xl space-y-4">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="fromStoreId" value={fromStoreId} />
      <input type="hidden" name="toStoreId" value={toStoreId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="memo" value={memo} />

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

          <Field name="quantity" label="Quantity" required error={e?.quantity}>
            <Input
              {...fieldProps('quantity', e?.quantity)}
              inputMode="decimal"
              className="tabular"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
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
        <SubmitButton pendingLabel="Transferring…">Transfer stock</SubmitButton>
      </div>
    </form>
  )
}
