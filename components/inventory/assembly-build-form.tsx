'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field } from '@/components/forms/field'
import { LockedNumber } from '@/components/forms/locked-number'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { saveAssemblyBuildForm } from '@/app/(app)/inventory/actions'

export type AssemblyOption = {
  id: string
  label: string
  onHand: string
  averageCost: string
  estimatedCost: string
  components: {
    id: string
    label: string
    quantity: string
    onHand: string
    averageCost: string
    byStore: Record<string, string>
  }[]
}

type StoreOption = { id: string; label: string; isOffice?: boolean }

export function AssemblyBuildForm({
  assemblies,
  stores,
  today,
  currency,
  documentNumber,
  initialItemId,
}: {
  assemblies: AssemblyOption[]
  stores: StoreOption[]
  today: string
  currency: string
  documentNumber: string
  initialItemId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveAssemblyBuildForm, idleState)
  const [number, setNumber] = usePropState(documentNumber)
  const [date, setDate] = useState(today)
  const [itemId, setItemId] = useState(
    initialItemId && assemblies.some((row) => row.id === initialItemId) ? initialItemId : '',
  )
  const [storeId, setStoreId] = useState(stores.find((store) => store.isOffice)?.id ?? stores[0]?.id ?? '')
  const [quantity, setQuantity] = useState('1')
  const [memo, setMemo] = useState('')
  const handled = useRef(false)
  const afterSave = useRef<'close' | 'new'>('close')

  const assembly = useMemo(
    () => assemblies.find((row) => row.id === itemId) ?? null,
    [assemblies, itemId],
  )

  const buildQty = parseMoneyInput(quantity) ?? ZERO
  const preview = useMemo(() => {
    if (!assembly || !buildQty.greaterThan(0)) return []
    return assembly.components.map((component) => {
      const bomQty = new Decimal(component.quantity)
      const needed = bomQty.times(buildQty)
      const onHand = storeId
        ? new Decimal(component.byStore[storeId] ?? '0')
        : new Decimal(component.onHand)
      const avg = new Decimal(component.averageCost)
      const value = needed.times(avg)
      return {
        ...component,
        bomQty: bomQty.toFixed(4),
        needed: needed.toFixed(4),
        onHand: onHand.toFixed(4),
        remaining: onHand.minus(needed).toFixed(4),
        short: needed.greaterThan(onHand),
        value,
      }
    })
  }, [assembly, buildQty, storeId])

  const materialsTotal = preview.reduce((sum, row) => sum.plus(row.value), ZERO)
  const unitCost = buildQty.greaterThan(0)
    ? materialsTotal.dividedBy(buildQty).toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
    : ZERO
  const canSave = Boolean(itemId) && buildQty.greaterThan(0) && preview.length > 0

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Built.')
      if (afterSave.current === 'new') {
        setDate(today)
        setQuantity('1')
        setMemo('')
        router.refresh()
        return
      }
      router.push('/inventory/stock')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, today])

  const payload = {
    number,
    date,
    itemId,
    storeId: storeId || '',
    quantity,
    memo,
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <FormStatus state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LockedNumber
          label="Build no."
          value={number}
          onChange={setNumber}
          error={state.fieldErrors?.number}
        />
        <Field name="date" label="Date" required error={state.fieldErrors?.date}>
          <DateField value={date} onChange={setDate} />
        </Field>
        <Field name="itemId" label="Assembly" required error={state.fieldErrors?.itemId}>
          <EntityPicker
            options={assemblies.map((row) => ({ id: row.id, label: row.label }))}
            value={itemId || null}
            onChange={(next) => setItemId(next ?? '')}
            placeholder="Choose an assembly…"
            emptyMessage="No assemblies with a bill of materials."
          />
        </Field>
        <Field name="storeId" label="Store" error={state.fieldErrors?.storeId}>
          <NativeSelect value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="quantity" label="Quantity to build" required error={state.fieldErrors?.quantity}>
          <Input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
            className="tabular"
          />
        </Field>
        <Field name="unitCost" label={`Cost each (${currency})`}>
          <Input
            readOnly
            tabIndex={-1}
            className="tabular text-muted-foreground"
            value={unitCost.isZero() ? '—' : unitCost.toFixed(6)}
          />
        </Field>
        <Field name="total" label={`Materials total (${currency})`}>
          <Input
            readOnly
            tabIndex={-1}
            className="tabular text-muted-foreground"
            value={materialsTotal.isZero() ? '—' : formatMoney(materialsTotal, currency)}
          />
        </Field>
      </div>

      {assembly ? (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Component</th>
                <th className="px-3 py-2 font-medium">Per unit</th>
                <th className="px-3 py-2 font-medium">Needed</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">After</th>
                <th className="px-3 py-2 font-medium text-right">Avg cost</th>
                <th className="px-3 py-2 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 tabular">{row.bomQty}</td>
                  <td className="px-3 py-2 tabular">{row.needed}</td>
                  <td className="px-3 py-2 tabular">{row.onHand}</td>
                  <td
                    className={`px-3 py-2 tabular ${row.short ? 'text-destructive font-medium' : ''}`}
                  >
                    {row.remaining}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {formatMoney(row.averageCost, currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {formatMoney(row.value, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose an inventory assembly that has a bill of materials. Building consumes those parts at
          average cost and adds finished units on hand.
        </p>
      )}

      <Field name="memo" label="Memo" error={state.fieldErrors?.memo}>
        <Input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Optional note" />
      </Field>

      <div className="flex flex-wrap gap-2">
        <SubmitButton
          disabled={!canSave}
          onClick={() => {
            afterSave.current = 'close'
          }}
        >
          Build and close
        </SubmitButton>
        <SubmitButton
          variant="outline"
          disabled={!canSave}
          onClick={() => {
            afterSave.current = 'new'
          }}
        >
          Build and new
        </SubmitButton>
      </div>
    </form>
  )
}
