'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Trash2Icon } from 'lucide-react'
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
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { saveAdjustmentForm } from '@/app/(app)/inventory/actions'

type ItemOption = { id: string; label: string; onHand: string; averageCost: string }
type Line = { key: number; itemId: string; counted: string; description: string }
type AdjustMode = 'count' | 'damage' | 'cost'

const MODES: { id: AdjustMode; label: string }[] = [
  { id: 'count', label: 'Count' },
  { id: 'damage', label: 'Damage or loss' },
  { id: 'cost', label: 'Add cost' },
]

/**
 * A stock count.
 *
 * The form asks for what the count *found*, not for the difference — because that
 * is what the person holding the clipboard actually knows. The difference is
 * shown as they type, so a typo is obvious before it is posted.
 */
const ITEM_ROWS = 20
const blankLine = (key: number): Line => ({ key, itemId: '', counted: '', description: '' })

export function AdjustmentForm({
  items,
  accounts,
  today,
  currency,
  documentNumber,
  initialItemId,
  initialMode = 'count',
}: {
  items: ItemOption[]
  accounts: AccountPickerOption[]
  today: string
  currency: string
  documentNumber: string
  /** Opens the count already sitting on this product. */
  initialItemId?: string
  initialMode?: AdjustMode
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveAdjustmentForm, idleState)

  const [number, setNumber] = useState(documentNumber)
  const [date, setDate] = useState(today)
  const [accountId, setAccountId] = useState('')
  const [reason, setReason] = useState('')
  const [memo, setMemo] = useState('')
  const [mode, setMode] = useState<AdjustMode>(initialMode)
  const [lines, setLines] = useState<Line[]>(() => {
    const rows = Array.from({ length: ITEM_ROWS }, (_, index) => blankLine(index + 1))
    if (initialItemId && items.some((item) => item.id === initialItemId)) rows[0]!.itemId = initialItemId
    return rows
  })
  const nextKey = useRef(ITEM_ROWS + 1)
  const handled = useRef(false)
  const afterSave = useRef<'close' | 'new'>('close')

  useEffect(() => setNumber(documentNumber), [documentNumber])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Posted.')
      if (afterSave.current === 'new') {
        setDate(today)
        setAccountId('')
        setReason('')
        setMemo('')
        setLines(Array.from({ length: ITEM_ROWS }, (_, index) => blankLine(index + 1)))
        nextKey.current = ITEM_ROWS + 1
        router.refresh()
        return
      }
      router.push('/inventory/stock')
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, today])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const totals = useMemo(() => {
    let value = ZERO
    for (const line of lines) {
      const item = line.itemId ? itemById.get(line.itemId) : null
      const entered = parseMoneyInput(line.counted)
      if (!item || !entered) continue
      if (mode === 'cost') value = value.plus(entered)
      else if (mode === 'damage') {
        const left = new Decimal(item.onHand).minus(entered)
        if (left.isZero()) value = value.minus(new Decimal(item.onHand).times(item.averageCost))
      } else {
        value = value.plus(entered.minus(item.onHand).times(item.averageCost))
      }
    }
    return value
  }, [lines, itemById, mode])

  const filled = lines.filter((line) => line.itemId && line.counted !== '')

  const payload = JSON.stringify({
    number,
    date,
    mode,
    accountId,
    reason,
    memo,
    lines: filled.map((line) => ({
      itemId: line.itemId,
      countedQuantity: line.counted,
      description: line.description,
    })),
  })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <FormStatus state={state} />

          <LockedNumber
            label="Adjustment number"
            value={number}
            onChange={setNumber}
            error={state.fieldErrors?.number}
          />

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

          <Field
            name="accountId"
            label="Difference goes to"
            hint={
              mode === 'damage'
                ? 'Left blank, saving creates Inventory Damage and Loss. A partial loss keeps its cost on the item.'
                : mode === 'cost'
                  ? 'The amount is added to the item, so its cost rises. The difference is credited here.'
                  : 'Inventory Shrinkage unless you say otherwise.'
            }
            error={state.fieldErrors?.accountId}
          >
            <AccountPicker
              id="accountId"
              name="accountId"
              options={accounts}
              value={accountId || null}
              onChange={(next) => setAccountId(next ?? '')}
              placeholder="Inventory Shrinkage (default)"
              clearable
              error={state.fieldErrors?.accountId}
            />
          </Field>

          <Field name="reason" label="Reason" error={state.fieldErrors?.reason}>
            <Input
              {...fieldProps('reason', state.fieldErrors?.reason)}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Quarterly count"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Adjustment">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
            className={`rounded-md px-2.5 py-1 text-sm ${
              mode === item.id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="min-h-[70vh] overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#d5dde6]">
                <th className="w-72 px-3 py-3 text-left text-xs font-medium">Item</th>
                <th className="w-28 px-3 py-3 text-right text-xs font-medium">Books say</th>
                <th className="w-36 px-3 py-3 text-right text-xs font-medium">
                  {mode === 'damage' ? 'Qty damaged' : mode === 'cost' ? 'Cost to add' : 'Count found'}
                </th>
                <th className="w-36 px-3 py-3 text-right text-xs font-medium">
                  {mode === 'damage' ? 'Cost kept' : mode === 'cost' ? 'Cost now' : 'Difference'}
                </th>
                <th className="w-36 px-3 py-3 text-right text-xs font-medium">
                  {mode === 'count' ? 'Value' : 'New cost'}
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium">Note</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const item = line.itemId ? itemById.get(line.itemId) : null
                const entered = parseMoneyInput(line.counted)
                const onHand = item ? new Decimal(item.onHand) : null
                const average = item ? new Decimal(item.averageCost) : null
                const change = item && entered && mode === 'count' ? entered.minus(item.onHand) : null
                const value = item && change ? change.times(item.averageCost) : null
                const damagedLeft = onHand && entered && mode === 'damage' ? onHand.minus(entered) : null
                const kept =
                  average && entered && mode === 'damage' && damagedLeft && damagedLeft.isPositive()
                    ? entered.times(average)
                    : null
                const newCost =
                  mode === 'cost' && onHand && average && entered && onHand.isPositive()
                    ? onHand.times(average).plus(entered).dividedBy(onHand)
                    : mode === 'damage' && damagedLeft && onHand && average && damagedLeft.isPositive()
                      ? onHand.times(average).dividedBy(damagedLeft)
                      : null

                return (
                  <tr
                    key={line.key}
                    className={`border-b last:border-0 ${index % 2 === 1 ? 'bg-[#c5dff3]' : 'bg-white'}`}
                  >
                    <td className="px-2 py-2">
                      <EntityPicker
                        options={items}
                        value={line.itemId || null}
                        onChange={(next) =>
                          setLines((current) =>
                            current.map((l) => (l.key === line.key ? { ...l, itemId: next ?? '' } : l)),
                          )
                        }
                        placeholder="Search items"
                      />
                    </td>
                    <td className="tabular px-3 py-3 text-right text-muted-foreground">
                      {item?.onHand ?? '—'}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={mode === 'damage' ? 'Quantity damaged' : mode === 'cost' ? 'Cost to add' : 'Counted quantity'}
                        inputMode="decimal"
                        className="tabular text-right"
                        value={line.counted}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((l) =>
                              l.key === line.key ? { ...l, counted: event.target.value } : l,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {mode === 'count'
                        ? change
                          ? `${change.isPositive() ? '+' : ''}${change.toFixed(2)}`
                          : '—'
                        : mode === 'damage'
                          ? kept
                            ? formatMoney(kept, currency)
                            : '—'
                          : average
                            ? formatMoney(average, currency)
                            : '—'}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {mode === 'count'
                        ? value
                          ? formatMoney(value, currency)
                          : '—'
                        : newCost
                          ? formatMoney(newCost, currency)
                          : '—'}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label="Note"
                        value={line.description}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((l) =>
                              l.key === line.key ? { ...l, description: event.target.value } : l,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-1 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Clear line"
                        onClick={() =>
                          setLines((current) =>
                            current.length <= ITEM_ROWS
                              ? current.map((row) => (row.key === line.key ? blankLine(row.key) : row))
                              : current.filter((row) => row.key !== line.key),
                          )
                        }
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((current) => [
                ...current,
                { key: nextKey.current++, itemId: '', counted: '', description: '' },
              ])
            }
          >
            <PlusIcon /> Add an item
          </Button>

          <span className="text-sm">
            <span className="text-muted-foreground">
              {mode === 'cost' ? 'Cost added ' : mode === 'damage' ? 'Value leaving stock ' : 'Change in stock value '}
            </span>
            <span
              className={`tabular text-base font-semibold ${
                totals.isNegative() ? 'text-destructive' : ''
              }`}
            >
              {formatMoney(totals, currency)}
            </span>
          </span>
        </div>
      </Card>

      <Card>
        <CardContent className="p-4">
          <Field name="memo" label="Note" error={state.fieldErrors?.memo}>
            <Input
              {...fieldProps('memo', state.fieldErrors?.memo)}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/inventory/stock')}>
          Close
        </Button>
        <SubmitButton
          variant="outline"
          disabled={filled.length === 0}
          pendingLabel="Saving…"
          onClick={() => {
            afterSave.current = 'close'
          }}
        >
          Save and close
        </SubmitButton>
        <SubmitButton
          disabled={filled.length === 0}
          pendingLabel="Saving…"
          onClick={() => {
            afterSave.current = 'new'
          }}
        >
          Save and new
        </SubmitButton>
      </div>
    </form>
  )
}
