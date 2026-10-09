'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
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
import type { AccountPickerOption } from '@/lib/account-options'
import { formatDate, isCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { dueDateFor, type PaymentTermShape } from '@/lib/payment-terms'
import { FORM_SHEET, VENDOR_CREDIT } from '@/lib/credit-brand'
import type { PurchaseTypeConfig } from '@/lib/purchase-types'
import { cn } from '@/lib/utils'
import { LineStore } from '@/components/inventory/line-store'
import { officeStoreId, type StockByStore, type StoreChoice } from '@/lib/store-stock'
import { savePurchaseForm } from '@/app/(app)/purchases/actions'

export type VendorOption = {
  id: string
  label: string
  email: string | null
  mailingAddress: string
  paymentTermId: string | null
  defaultExpenseAccountId: string | null
}
export type PurchaseItemOption = {
  id: string
  label: string
  price: string | null
  description: string | null
  taxCodeId: string | null
  expenseAccountId: string | null
  /** SERVICE | NON_INVENTORY | INVENTORY — decides the picker heading. */
  type?: string
  group?: string
  /** Stock on hand, for tracked items. */
  onHand?: string | null
}
export type Option = { id: string; label: string } & Partial<PaymentTermShape>
export type TaxOption = Option & { rate: number; isInclusive: boolean }

/**
 * One line, of one of two kinds.
 *
 * A `category` line names the account a cost lands in and an amount; its
 * quantity is always 1 and `unitPrice` carries the amount, which is how the
 * server has always accepted it. An `item` line names a product, a quantity and
 * a unit cost. Both shapes travel in the same array because the document stores
 * them in one list — the split is how they are *entered*, not how they are kept.
 */
type LineKind = 'category' | 'item'

type Line = {
  key: number
  kind: LineKind
  itemId: string
  expenseAccountId: string
  description: string
  quantity: string
  unitPrice: string
  taxCodeId: string
  storeId: string
}

const ITEM_ROWS = 4

const empty = (key: number, account = '', kind: LineKind = 'category', storeId = ''): Line => ({
  key,
  kind,
  itemId: '',
  expenseAccountId: account,
  description: '',
  quantity: kind === 'item' ? '' : '1',
  unitPrice: '',
  taxCodeId: '',
  storeId,
})

function withItemRows(seeded: Line[], storeId = ''): Line[] {
  const rows = [...seeded]
  let key = rows.reduce((max, line) => Math.max(max, line.key), 0)
  while (rows.filter((line) => line.kind === 'item').length < ITEM_ROWS) {
    key += 1
    rows.push(empty(key, '', 'item', storeId))
  }
  return rows
}

/**
 * One form for bills, expenses, vendor credits and purchase orders.
 *
 * The purchase side asks one thing the sales side does not: **where does this
 * cost go?** Every line names an expense or asset account, pre-filled from the
 * item or the vendor's default, because a bill that lands in Uncategorised
 * Expense is a bill somebody has to come back to.
 */
export function BillForm({
  config,
  vendors,
  items,
  taxCodes,
  paymentAccounts,
  expenseAccounts,
  terms,
  today,
  currency,
  documentNumber,
  document,
  initialVendorId,
  stores = [],
  stock = {},
}: {
  config: PurchaseTypeConfig
  vendors: VendorOption[]
  items: PurchaseItemOption[]
  taxCodes: TaxOption[]
  paymentAccounts: AccountPickerOption[]
  expenseAccounts: AccountPickerOption[]
  terms: Option[]
  today: string
  currency: string
  /** The number this document has, or the next one if it has not been saved. */
  documentNumber: string
  /** Set when a vendor page opened this form, so the vendor is already chosen. */
  initialVendorId?: string
  /** Present when editing. Saving reverses the original journal and posts a new one. */
  document?: {
    id: string
    vendorId: string
    date: string
    reference: string | null
    memo: string | null
    paymentTermId: string | null
    paymentAccountId: string | null
    lines: {
      itemId: string | null
      expenseAccountId: string | null
      description: string | null
      quantity: string
      unitPrice: string
      taxCodeId: string | null
      storeId?: string | null
    }[]
  }
  /** Stores a purchased item can be received into. The office is the default. */
  stores?: StoreChoice[]
  stock?: StockByStore
}) {
  const officeId = officeStoreId(stores)
  const router = useRouter()
  const [state, formAction] = useActionState(savePurchaseForm, idleState)

  const [number, setNumber] = usePropState(documentNumber)
  const [vendorId, setVendorId] = useState(document?.vendorId ?? initialVendorId ?? '')
  const [date, setDate] = useState(document?.date ?? today)
  const [reference, setReference] = useState(document?.reference ?? '')
  const [memo, setMemo] = useState(document?.memo ?? '')
  const [paymentTermId, setPaymentTermId] = useState(document?.paymentTermId ?? '')
  const [paymentAccountId, setPaymentAccountId] = useState(
    document?.paymentAccountId ?? paymentAccounts[0]?.id ?? '',
  )
  const [lines, setLines] = useState<Line[]>(() =>
    withItemRows(
      document?.lines.length
        ? document.lines.map((line, index) => ({
            key: index + 1,
            // A stored line is an item line if it names an item; otherwise it is a
            // category line, whatever it was typed into originally.
            kind: line.itemId ? ('item' as const) : ('category' as const),
            itemId: line.itemId ?? '',
            expenseAccountId: line.expenseAccountId ?? '',
            description: line.description ?? '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxCodeId: line.taxCodeId ?? '',
            storeId: line.storeId ?? officeId,
          }))
        : [empty(1), empty(2)],
      officeId,
    ),
  )
  const [saveAsDraft, setSaveAsDraft] = useState(false)
  /** Category lines stay hidden until asked for — most bills are item-only. */
  const [showCategories, setShowCategories] = useState(() =>
    Boolean(
      document?.lines.some(
        (line) =>
          !line.itemId &&
          (Boolean(line.expenseAccountId) || Boolean(line.description) || Number(line.unitPrice) !== 0),
      ),
    ),
  )
  const nextKey = useRef(lines.reduce((max, line) => Math.max(max, line.key), 0) + 1)
  const handled = useRef(false)
  const afterSave = useRef<'close' | 'new'>('close')

  // Start on the vendor name so Tab walks the form without the mouse.
  useEffect(() => {
    if (vendorId) return
    const timer = window.setTimeout(() => window.document.getElementById('vendorId')?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [vendorId])

  const seedVendor = !document && Boolean(initialVendorId)
  const [vendorSeeded, setVendorSeeded] = useState(!seedVendor)
  if (!vendorSeeded && initialVendorId) {
    setVendorSeeded(true)
    const chosen = vendors.find((vendor) => vendor.id === initialVendorId)
    if (chosen?.paymentTermId) setPaymentTermId(chosen.paymentTermId)
    const fallback = chosen?.defaultExpenseAccountId ?? ''
    if (fallback) {
      setLines((current) =>
        current.map((line) =>
          line.expenseAccountId === '' && line.itemId === '' ? { ...line, expenseAccountId: fallback } : line,
        ),
      )
    }
  }

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      if (afterSave.current === 'new' && !document?.id) {
        setVendorId('')
        setDate(today)
        setReference('')
        setMemo('')
        setPaymentTermId('')
        setPaymentAccountId(paymentAccounts[0]?.id ?? '')
        setLines(withItemRows([empty(1), empty(2)]))
        nextKey.current = ITEM_ROWS + 3
        router.refresh()
        return
      }
      // A fresh purchase order's next job is receiving — send them there so the
      // receive screen is not buried two clicks into a list menu.
      const savedId = state.created?.id ?? document?.id
      router.push(
        afterSave.current === 'new'
          ? `/purchases/${config.slug}/new`
          : config.type === 'PURCHASE_ORDER' && savedId
            ? `/purchases/purchase-orders/${savedId}/receive`
            : `/purchases/${config.slug}`,
      )
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, config.slug, config.type, document?.id, today, paymentAccounts])

  const categoryLines = lines.filter((line) => line.kind === 'category')
  const itemLines = lines.filter((line) => line.kind === 'item')

  const defaultAccount = () => vendors.find((v) => v.id === vendorId)?.defaultExpenseAccountId ?? ''

  const addCategoryLine = () =>
    setLines((current) => [...current, empty(nextKey.current++, defaultAccount(), 'category')])

  const addItemLine = () => setLines((current) => [...current, empty(nextKey.current++, '', 'item', officeId)])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  /** Grouped by kind, with stock on hand beside anything tracked. */
  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: item.label,
        group: item.group,
        hint: item.onHand != null ? `${item.onHand} on hand` : undefined,
      })),
    [items],
  )
  const taxById = useMemo(() => new Map(taxCodes.map((code) => [code.id, code])), [taxCodes])

  /**
   * No tax codes set up means this business does not charge tax, so the column
   * is not shown at all. An empty dropdown reading "No tax" on every line is a
   * question the form is asking and already knows the answer to.
   */
  const showTax = taxCodes.length > 0

  const totals = useMemo(() => {
    let subtotal = ZERO
    let tax = ZERO

    for (const line of lines) {
      const quantity = line.kind === 'category' ? new Decimal(1) : (parseMoneyInput(line.quantity) ?? ZERO)
      const price = parseMoneyInput(line.unitPrice) ?? ZERO
      if (quantity.isZero() && price.isZero()) continue

      const amount = quantity.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const code = line.taxCodeId ? taxById.get(line.taxCodeId) : null

      if (!code) {
        subtotal = subtotal.plus(amount)
        continue
      }

      if (code.isInclusive) {
        const net = amount.dividedBy(new Decimal(1).plus(code.rate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        subtotal = subtotal.plus(net)
        tax = tax.plus(amount.minus(net))
      } else {
        subtotal = subtotal.plus(amount)
        tax = tax.plus(amount.times(code.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
      }
    }

    return { subtotal, tax, total: subtotal.plus(tax) }
  }, [lines, taxById])

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  /** Choosing a vendor pre-fills empty lines with their usual cost account. */
  const chooseVendor = (id: string) => {
    setVendorId(id)
    const chosen = vendors.find((vendor) => vendor.id === id)
    if (chosen?.paymentTermId) setPaymentTermId(chosen.paymentTermId)
    const fallback = chosen?.defaultExpenseAccountId ?? ''
    if (!fallback) return
    setLines((current) =>
      current.map((line) =>
        line.expenseAccountId === '' && line.itemId === ''
          ? { ...line, expenseAccountId: fallback }
          : line,
      ),
    )
  }

  const chooseItem = (key: number, itemId: string) => {
    const item = itemId ? itemById.get(itemId) : null
    // No account is set here. An item line's cost account comes from the item —
    // and for a tracked item from its inventory account — resolved on the server,
    // which is the only place that knows whether the item is stocked.
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              itemId,
              description: item?.description ?? '',
              unitPrice: item?.price ?? '',
              taxCodeId: item?.taxCodeId ?? '',
              quantity: line.quantity.trim() === '' ? '1' : line.quantity,
            }
          : line,
      ),
    )
  }

  const filled = lines.filter((line) =>
    line.kind === 'category'
      ? line.expenseAccountId || line.description || parseMoneyInput(line.unitPrice)?.greaterThan(0)
      : line.itemId || line.description || parseMoneyInput(line.unitPrice)?.greaterThan(0),
  )

  const payload = JSON.stringify({
    ...(document?.id ? { id: document.id } : { type: config.type }),
    number,
    vendorId,
    date,
    reference,
    memo,
    paymentTermId,
    paymentAccountId: config.needsPaymentAccount ? paymentAccountId : '',
    saveAsDraft,
    lines: filled.map((line) => ({
      // A category line has no item and always a quantity of one; an item line
      // takes its account from the item, not from this form.
      itemId: line.kind === 'item' ? line.itemId : '',
      expenseAccountId: line.kind === 'category' ? line.expenseAccountId : '',
      description: line.description,
      quantity: line.kind === 'category' ? '1' : line.quantity || '1',
      unitPrice: line.unitPrice,
      taxCodeId: line.taxCodeId,
      storeId: line.kind === 'item' ? line.storeId : '',
    })),
  })

  const canSave = vendorId !== '' && filled.length > 0 && totals.total.greaterThan(0)
  const term = terms.find((row) => row.id === paymentTermId)
  const due =
    isCalendarDate(date) && term?.type
      ? dueDateFor(date, { type: term.type, dueDays: term.dueDays ?? 0 })
      : isCalendarDate(date)
        ? date
        : ''
  const owed = config.type === 'BILL' || config.type === 'VENDOR_CREDIT'
  const isVendorCredit = config.type === 'VENDOR_CREDIT'

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="payload" value={payload} />

      <Card className="overflow-hidden bg-white p-0">
        {isVendorCredit ? (
          <div className="px-4 py-2 text-white sm:px-5" style={{ background: VENDOR_CREDIT.accent }}>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/85">Vendor credit</p>
            <p className="text-base font-semibold tracking-wide">{config.singular}</p>
          </div>
        ) : null}
        <CardContent
          className="space-y-3 p-3 sm:p-4"
          style={isVendorCredit ? { background: VENDOR_CREDIT.wash } : undefined}
        >
          <FormStatus state={state} />

          {/* Name → Date → Number → Due → PO */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]">
            <Field name="vendorId" label="Vendor name" required error={state.fieldErrors?.vendorId}>
              <EntityPicker
                id="vendorId"
                kind="vendor"
                options={vendors}
                value={vendorId || null}
                onChange={(next) => chooseVendor(next ?? '')}
                placeholder="Choose a vendor"
                required
                error={state.fieldErrors?.vendorId}
              />
            </Field>
            <Field
              name="date"
              label={config.needsPaymentAccount ? 'Payment date' : 'Date'}
              required
              error={state.fieldErrors?.date}
            >
              <DateField
                id="date"
                value={date}
                onChange={setDate}
                today={today}
                required
                aria-invalid={state.fieldErrors?.date ? true : undefined}
              />
            </Field>
            <LockedNumber
              label={`${config.singular} no.`}
              value={number}
              onChange={setNumber}
              error={state.fieldErrors?.number}
              recordId={document?.id}
            />
            {owed ? (
              <Field name="dueDate" label="Due date">
                <Input id="dueDate" value={due ? formatDate(due) : ''} readOnly />
              </Field>
            ) : (
              <div />
            )}
            <Field name="reference" label="PO" error={state.fieldErrors?.reference}>
              <Input
                {...fieldProps('reference', state.fieldErrors?.reference, true)}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="PO / bill no."
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {owed ? (
              <Field name="paymentTermId" label="Terms" error={state.fieldErrors?.paymentTermId}>
                <NativeSelect
                  {...fieldProps('paymentTermId', state.fieldErrors?.paymentTermId)}
                  value={paymentTermId}
                  onChange={(event) => setPaymentTermId(event.target.value)}
                >
                  <option value="">Due on receipt</option>
                  {terms.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            {config.needsPaymentAccount ? (
              <Field
                name="paymentAccountId"
                label="Payment account"
                required
                error={state.fieldErrors?.paymentAccountId}
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
            ) : null}
            <div className="text-right lg:col-start-4">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {config.needsPaymentAccount ? 'Amount paid' : 'Balance due'}
              </p>
              <p
                className={cn('text-lg font-semibold tabular', !isVendorCredit && 'text-primary')}
                style={isVendorCredit ? { color: VENDOR_CREDIT.ink } : undefined}
              >
                {formatMoney(totals.total, currency)}
              </p>
            </div>
          </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Category details</h2>
            <p className="text-xs text-muted-foreground">
              A cost posted straight to an account. No quantity.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showCategories}
            onClick={() => {
              setShowCategories((open) => {
                if (!open && categoryLines.length === 0) addCategoryLine()
                return !open
              })
            }}
          >
            {showCategories ? <ChevronUpIcon /> : <ChevronDownIcon />}
            {showCategories ? 'Hide categories' : 'Show categories'}
          </Button>
        </div>

        {showCategories ? (
          <>
            <div className="mt-2 overflow-x-auto rounded-md border">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr
                    className="text-[12px] font-semibold uppercase tracking-wide text-white"
                    style={{ background: isVendorCredit ? VENDOR_CREDIT.accent : FORM_SHEET.accent }}
                  >
                    <th className="w-64 px-2 py-2 text-left">Category</th>
                    <th className="px-2 py-2 text-left">Description</th>
                    {showTax ? <th className="w-36 px-2 py-2 text-left">Tax</th> : null}
                    <th className="w-32 px-2 py-2 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {categoryLines.length === 0 ? (
                    <tr>
                      <td colSpan={showTax ? 5 : 4} className="px-3 py-4 text-sm text-muted-foreground">
                        Nothing categorised yet.
                      </td>
                    </tr>
                  ) : null}
                  {categoryLines.map((line, index) => (
                    <tr key={line.key} className={index % 2 === 0 ? 'ledger-row' : 'ledger-row-alt'}>
                      <td className="px-2 py-1.5">
                        <AccountPicker
                          options={expenseAccounts}
                          value={line.expenseAccountId || null}
                          onChange={(next) => update(line.key, { expenseAccountId: next ?? '' })}
                          clearable
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label="Description"
                          value={line.description}
                          onChange={(event) => update(line.key, { description: event.target.value })}
                        />
                      </td>
                      {showTax ? (
                        <td className="px-2 py-1.5">
                          <NativeSelect
                            aria-label="Tax code"
                            value={line.taxCodeId}
                            onChange={(event) => update(line.key, { taxCodeId: event.target.value })}
                          >
                            <option value="">No tax</option>
                            {taxCodes.map((code) => (
                              <option key={code.id} value={code.id}>
                                {code.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                      ) : null}
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label="Amount"
                          inputMode="decimal"
                          className="tabular text-right"
                          value={line.unitPrice}
                          onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          tabIndex={-1}
                          aria-label="Remove line"
                          onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                        >
                          <Trash2Icon />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addCategoryLine}>
              <PlusIcon /> Add a category
            </Button>
          </>
        ) : null}
      </div>

      <div>
        <h2 className="text-sm font-semibold">Item details</h2>
        <p className="text-xs text-muted-foreground">A product bought. A tracked item moves stock.</p>
        <div className="mt-2 overflow-x-auto rounded-md border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
                <tr
                  className="text-[12px] font-semibold uppercase tracking-wide text-white"
                  style={{ background: isVendorCredit ? VENDOR_CREDIT.accent : FORM_SHEET.accent }}
                >
                <th className="w-44 px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="w-16 px-2 py-2 text-center">Qty</th>
                <th className="w-28 px-2 py-2 text-right">Rate</th>
                {showTax ? <th className="w-36 px-2 py-2 text-left">Tax</th> : null}
                <th className="w-28 px-2 py-2 text-right">Amount</th>
                {stores.length > 0 ? <th className="w-40 px-2 py-2 text-left">Store</th> : null}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {itemLines.length === 0 ? (
                <tr>
                  <td colSpan={(showTax ? 7 : 6) + (stores.length > 0 ? 1 : 0)} className="px-3 py-4 text-sm text-muted-foreground">
                    No products on this document.
                  </td>
                </tr>
              ) : null}
              {itemLines.map((line, index) => {
                return (
                  <tr key={line.key} className={index % 2 === 0 ? 'ledger-row' : 'ledger-row-alt'}>
                    <td className="px-2 py-1.5">
                      <EntityPicker
                        kind="item"
                        options={itemOptions}
                        value={line.itemId || null}
                        onChange={(next) => chooseItem(line.key, next ?? '')}
                        placeholder="Search or add an item"
                        clearable
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label="Description"
                        value={line.description}
                        onChange={(event) => update(line.key, { description: event.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label="Quantity"
                        inputMode="decimal"
                        className="tabular text-right"
                        value={line.quantity}
                        onChange={(event) => update(line.key, { quantity: event.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label="Unit cost"
                        inputMode="decimal"
                        className="tabular text-right"
                        value={line.unitPrice}
                        onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                      />
                    </td>
                    {showTax ? (
                      <td className="px-2 py-1.5">
                        <NativeSelect
                          aria-label="Tax code"
                          value={line.taxCodeId}
                          onChange={(event) => update(line.key, { taxCodeId: event.target.value })}
                        >
                          <option value="">No tax</option>
                          {taxCodes.map((code) => (
                            <option key={code.id} value={code.id}>
                              {code.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                    ) : null}
                    <td className="px-1 py-1">
                      <ItemAmount line={line} onCommit={(next) => update(line.key, next)} />
                    </td>
                    {stores.length > 0 ? (
                      <td className="px-1 py-1 align-top">
                        <LineStore
                          stores={stores}
                          stock={stock}
                          tracked={items.some((item) => item.id === line.itemId && item.type === 'INVENTORY')}
                          warn={false}
                          itemId={line.itemId}
                          storeId={line.storeId}
                          quantity={line.quantity}
                          onChange={(storeId) => update(line.key, { storeId })}
                          label="Store"
                        />
                      </td>
                    ) : null}
                    <td className="px-1 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        tabIndex={-1}
                        aria-label="Clear line"
                        onClick={() =>
                          setLines((current) => {
                            const items = current.filter((row) => row.kind === 'item')
                            if (items.length <= ITEM_ROWS) {
                              return current.map((row) =>
                                row.key === line.key ? empty(row.key, '', 'item', officeId) : row,
                              )
                            }
                            return current.filter((row) => row.key !== line.key)
                          })
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

        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addItemLine}>
          <PlusIcon /> Add line
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Field name="memo" label="Memo" error={state.fieldErrors?.memo}>
          <Input
            {...fieldProps('memo', state.fieldErrors?.memo)}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Internal note"
          />
        </Field>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular">{formatMoney(totals.subtotal, currency)}</dd>
          </div>
          {showTax ? (
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular">{formatMoney(totals.tax, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-6 border-t pt-1 font-medium">
            <dt>Total</dt>
            <dd className="tabular">{formatMoney(totals.total, currency)}</dd>
          </div>
        </dl>
      </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(`/purchases/${config.slug}`)}>
          Close
        </Button>
        <SubmitButton
          variant="outline"
          disabled={!canSave}
          pendingLabel="Saving…"
          onClick={() => {
            afterSave.current = 'close'
            setSaveAsDraft(false)
          }}
        >
          Save and close
        </SubmitButton>
        <SubmitButton
          disabled={!canSave}
          pendingLabel="Saving…"
          onClick={() => {
            afterSave.current = 'new'
            setSaveAsDraft(false)
          }}
        >
          Save and new
        </SubmitButton>
      </div>

    </form>
  )
}

const lineInput =
  'h-7 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-[#714B67] focus-visible:bg-white'

function costFromTotal(quantity: string, totalText: string): { quantity: string; unitPrice: string } | null {
  if (totalText.trim() === '') return { quantity, unitPrice: '' }
  const total = parseMoneyInput(totalText)
  if (total == null) return null
  const qty = parseMoneyInput(quantity)
  const count = qty && !qty.isZero() ? qty : new Decimal(1)
  const unit = total.dividedBy(count).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
  return {
    quantity: qty && !qty.isZero() ? quantity : '1',
    unitPrice: unit.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''),
  }
}

function ItemAmount({
  line,
  onCommit,
}: {
  line: Line
  onCommit: (next: { quantity: string; unitPrice: string }) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const quantity = parseMoneyInput(line.quantity) ?? ZERO
  const price = parseMoneyInput(line.unitPrice) ?? ZERO
  const amount = quantity.isZero() && price.isZero() ? null : quantity.times(price)
  const shown =
    draft ?? (amount ? amount.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : '')

  return (
    <Input
      aria-label="Amount"
      inputMode="decimal"
      className={cn(lineInput, 'tabular text-right')}
      value={shown}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        const next = costFromTotal(line.quantity, event.currentTarget.value)
        if (next) onCommit(next)
        setDraft(null)
      }}
    />
  )
}
