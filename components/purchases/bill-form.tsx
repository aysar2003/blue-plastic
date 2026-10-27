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
import { FormCustomizePanel } from '@/components/forms/form-customize-panel'
import { LockedNumber } from '@/components/forms/locked-number'
import { FormStatus } from '@/components/forms/form-status'
import { neighborHrefs, RecordNav } from '@/components/forms/record-nav'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { AccountPickerOption } from '@/lib/account-options'
import { formatDate, isCalendarDate } from '@/lib/date'
import type { FormCustomizationProps } from '@/lib/form-customization-props'
import {
  isColumnVisible,
  isFieldVisible,
  PURCHASE_CATEGORY_COLUMNS,
  PURCHASE_FORM_COLUMNS,
  PURCHASE_FORM_FIELDS,
} from '@/lib/form-field-catalog'
import type { FormTemplate } from '@/lib/form-templates'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { resolveUnit } from '@/lib/quantity'
import { dueDateFor, type PaymentTermShape } from '@/lib/payment-terms'
import { FORM_SHEET, VENDOR_CREDIT } from '@/lib/credit-brand'
import { defaultPurchaseLineRows, type PurchaseTypeConfig } from '@/lib/purchase-types'
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
export type CustomerOffsetOption = {
  id: string
  label: string
  email: string | null
  balance: string
  hint?: string
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
  unitOfMeasure?: string | null
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

function withItemRows(seeded: Line[], storeId = '', minimum = 15): Line[] {
  const rows = [...seeded]
  let key = rows.reduce((max, line) => Math.max(max, line.key), 0)
  while (rows.filter((line) => line.kind === 'item').length < minimum) {
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
  customers = [],
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
  initialProjectId,
  projects = [],
  neighbors,
  stores = [],
  stock = {},
  formCustomization,
}: {
  config: PurchaseTypeConfig
  vendors: VendorOption[]
  /** Customers whose balance can settle an expense (buy from shop / offset cost). */
  customers?: CustomerOffsetOption[]
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
  /** Set when the form was opened from a project job folder. */
  initialProjectId?: string
  /** Open jobs this purchase can belong to. */
  projects?: { id: string; label: string; customerId?: string }[]
  /** The saved document before this one, and the one after, in date then number order. */
  neighbors?: {
    previous: { id: string; number: string } | null
    next: { id: string; number: string } | null
  }
  /** Present when editing. Saving reverses the original journal and posts a new one. */
  document?: {
    id: string
    vendorId: string
    date: string
    reference: string | null
    memo: string | null
    paymentTermId: string | null
    paymentAccountId: string | null
    offsetCustomerId?: string | null
    projectId?: string | null
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
  formCustomization?: FormCustomizationProps
}) {
  const officeId = officeStoreId(stores)
  const [draftTemplate, setDraftTemplate] = useState<FormTemplate | null>(null)
  const [draftActiveId, setDraftActiveId] = useState<string | null>(null)
  const activeForm =
    draftTemplate && draftActiveId === formCustomization?.activeId
      ? draftTemplate
      : (formCustomization?.active ?? null)
  const setFormDraft = (next: FormTemplate) => {
    setDraftActiveId(formCustomization?.activeId ?? next.id)
    setDraftTemplate(next)
  }
  const showField = (id: string) => isFieldVisible(activeForm?.fields, id)
  const showColumn = (id: string) => isColumnVisible(activeForm?.columns, id)
  const showCategoryColumn = (id: string) =>
    isColumnVisible(activeForm?.categoryColumns ?? activeForm?.columns, id)
  const router = useRouter()
  const [state, formAction] = useActionState(savePurchaseForm, idleState)
  const isExpense = config.type === 'EXPENSE'

  const [number, setNumber] = usePropState(documentNumber)
  const [vendorId, setVendorId] = useState(document?.vendorId ?? initialVendorId ?? '')
  const [projectId, setProjectId] = useState(document?.projectId ?? initialProjectId ?? '')
  const [date, setDate] = useState(document?.date ?? today)
  const [reference, setReference] = useState(document?.reference ?? '')
  const [memo, setMemo] = useState(document?.memo ?? '')
  const [paymentTermId, setPaymentTermId] = useState(document?.paymentTermId ?? '')
  const [paymentSource, setPaymentSource] = useState<'bank' | 'customer'>(() =>
    document?.offsetCustomerId ? 'customer' : 'bank',
  )
  const [offsetCustomerId, setOffsetCustomerId] = useState(document?.offsetCustomerId ?? '')
  const [paymentAccountId, setPaymentAccountId] = useState(
    document?.paymentAccountId ?? paymentAccounts[0]?.id ?? '',
  )
  const itemRows = defaultPurchaseLineRows(config.type)
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
      defaultPurchaseLineRows(config.type),
    ),
  )
  /** Ref so the click that chooses draft/post is what the payload reads on submit. */
  const saveAsDraft = useRef(false)
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

  /** Wipe typed fields back to a blank sheet (or the last saved document when editing). */
  const resetForm = () => {
    if (document) {
      setNumber(documentNumber)
      setVendorId(document.vendorId)
      setDate(document.date)
      setReference(document.reference ?? '')
      setMemo(document.memo ?? '')
      setPaymentTermId(document.paymentTermId ?? '')
      setPaymentSource(document.offsetCustomerId ? 'customer' : 'bank')
      setOffsetCustomerId(document.offsetCustomerId ?? '')
      setPaymentAccountId(document.paymentAccountId ?? paymentAccounts[0]?.id ?? '')
      const restored = withItemRows(
        document.lines.map((line, index) => ({
          key: index + 1,
          kind: line.itemId ? ('item' as const) : ('category' as const),
          itemId: line.itemId ?? '',
          expenseAccountId: line.expenseAccountId ?? '',
          description: line.description ?? '',
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxCodeId: line.taxCodeId ?? '',
          storeId: line.storeId ?? officeId,
        })),
        officeId,
        itemRows,
      )
      setLines(restored)
      setShowCategories(
        Boolean(
          document.lines.some(
            (line) =>
              !line.itemId &&
              (Boolean(line.expenseAccountId) ||
                Boolean(line.description) ||
                Number(line.unitPrice) !== 0),
          ),
        ),
      )
      nextKey.current = restored.reduce((max, line) => Math.max(max, line.key), 0) + 1
      return
    }
    setVendorId(initialVendorId ?? '')
    setOffsetCustomerId('')
    setPaymentSource('bank')
    setDate(today)
    setReference('')
    setMemo('')
    setPaymentTermId(
      initialVendorId
        ? (vendors.find((vendor) => vendor.id === initialVendorId)?.paymentTermId ?? '')
        : '',
    )
    setPaymentAccountId(paymentAccounts[0]?.id ?? '')
    const fallback =
      (initialVendorId
        ? vendors.find((vendor) => vendor.id === initialVendorId)?.defaultExpenseAccountId
        : null) ?? ''
    const blank = withItemRows(
      fallback
        ? [empty(1, fallback), empty(2, fallback)]
        : [empty(1), empty(2)],
      officeId,
      itemRows,
    )
    setLines(blank)
    setShowCategories(false)
    nextKey.current = blank.reduce((max, line) => Math.max(max, line.key), 0) + 1
  }

  // Start on the party name so Tab walks the form without the mouse.
  useEffect(() => {
    if (isExpense && paymentSource === 'customer') {
      if (offsetCustomerId) return
      const timer = window.setTimeout(() => window.document.getElementById('offsetCustomerId')?.focus(), 0)
      return () => window.clearTimeout(timer)
    }
    if (config.vendorOptional || vendorId) return
    const timer = window.setTimeout(() => window.document.getElementById('vendorId')?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [vendorId, offsetCustomerId, isExpense, paymentSource, config.vendorOptional])

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
      toast.success(saveAsDraft.current ? 'Saved as draft.' : (state.message ?? 'Saved.'))
      if (afterSave.current === 'new' && !document?.id) {
        setVendorId('')
        setOffsetCustomerId('')
        setPaymentSource('bank')
        setDate(today)
        setReference('')
        setMemo('')
        setPaymentTermId('')
        setPaymentAccountId(paymentAccounts[0]?.id ?? '')
        setLines(withItemRows([empty(1), empty(2)], officeId, itemRows))
        nextKey.current = itemRows + 3
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
            : (config.type === 'PURCHASE_REQUEST' || config.type === 'RFQ') && savedId
              ? `/purchases/${config.slug}/${savedId}`
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
      items.map((item) => {
        const unit = resolveUnit(item.unitOfMeasure)
        return {
          id: item.id,
          label: item.label,
          group: item.group,
          unitOfMeasure: item.unitOfMeasure ?? null,
          hint: item.onHand != null ? `${item.onHand} ${unit} on hand` : undefined,
        }
      }),
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
              // PR and RFQ ask the supplier for a price. The item's stored cost
              // stays off the line until a purchase order, bill, or expense.
              unitPrice:
                config.type === 'PURCHASE_REQUEST' || config.type === 'RFQ'
                  ? ''
                  : (item?.price ?? ''),
              taxCodeId: item?.taxCodeId ?? '',
              quantity: line.quantity.trim() === '' ? '1' : line.quantity,
            }
          : line,
      ),
    )
  }

  const lineTouched = (line: Line) =>
    Boolean(line.description.trim()) ||
    Boolean(parseMoneyInput(line.unitPrice)?.greaterThan(0)) ||
    (line.kind === 'item' && line.quantity.trim() !== '' && Number(line.quantity) !== 0)

  const lineNamed = (line: Line) =>
    line.kind === 'item' ? Boolean(line.itemId) : Boolean(line.expenseAccountId)

  // A touched row with no product and no expense account is a typed mistake
  // (text and a number). It must not be saved as Uncategorised Expense.
  const stray = lines.filter((line) => lineTouched(line) && !lineNamed(line))
  const filled = lines.filter((line) => lineNamed(line) && lineTouched(line))

  const payFromCustomer = isExpense && paymentSource === 'customer'
  const selectedCustomer = customers.find((customer) => customer.id === offsetCustomerId)
  const customerBalance = selectedCustomer ? new Decimal(selectedCustomer.balance || 0) : null

  const payloadInput = useRef<HTMLInputElement>(null)
  const payloadFor = (draft: boolean) =>
    JSON.stringify({
      ...(document?.id ? { id: document.id } : { type: config.type }),
      number,
      vendorId: payFromCustomer ? '' : vendorId,
      date,
      reference,
      memo,
      paymentTermId,
      paymentAccountId: config.needsPaymentAccount && !payFromCustomer ? paymentAccountId : '',
      offsetCustomerId: payFromCustomer ? offsetCustomerId : '',
      projectId,
      saveAsDraft: draft,
      lines: (draft ? lines.filter((line) => lineNamed(line) || lineTouched(line)) : filled).map((line) => ({
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

  const vendorOptional = Boolean(config.vendorOptional)
  const allowsZeroTotal =
    config.type === 'PURCHASE_ORDER' ||
    config.type === 'PURCHASE_REQUEST' ||
    config.type === 'RFQ'
  const hasParty = payFromCustomer
    ? offsetCustomerId !== ''
    : vendorOptional
      ? true
      : vendorId !== ''
  const canSave =
    hasParty && filled.length > 0 && (allowsZeroTotal || totals.total.greaterThan(0))
  const canDraft =
    (vendorOptional || hasParty) && lines.some((line) => lineNamed(line) || lineTouched(line))
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
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!saveAsDraft.current && stray.length > 0) {
          event.preventDefault()
          const sample = stray.find((line) => line.description.trim())?.description.trim()
          toast.error(
            sample
              ? `"${sample}" is not a product or an expense category. Choose one from the list, or clear the line.`
              : 'A line has an amount but no product or expense category. Choose one from the list, or clear the line.',
          )
          return
        }
        if (payloadInput.current) payloadInput.current.value = payloadFor(saveAsDraft.current)
      }}
      className="space-y-2"
    >
      <input ref={payloadInput} type="hidden" name="payload" defaultValue={payloadFor(false)} />

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <RecordNav {...neighborHrefs(`/purchases/${config.slug}`, neighbors, document?.id)} />
        {formCustomization && activeForm ? (
          <FormCustomizePanel
            family={formCustomization.family}
            templates={formCustomization.templates}
            activeId={formCustomization.activeId}
            draft={activeForm}
            onDraftChange={setFormDraft}
            fieldCatalog={PURCHASE_FORM_FIELDS}
            columnCatalog={PURCHASE_FORM_COLUMNS}
            categoryColumnCatalog={PURCHASE_CATEGORY_COLUMNS}
            canManage={formCustomization.canManage}
          />
        ) : null}
      </div>

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
            {payFromCustomer ? (
              <Field
                name="offsetCustomerId"
                label="Customer"
                required
                error={state.fieldErrors?.offsetCustomerId}
              >
                <EntityPicker
                  id="offsetCustomerId"
                  kind="customer"
                  options={customers}
                  value={offsetCustomerId || null}
                  onChange={(next) => setOffsetCustomerId(next ?? '')}
                  placeholder="Choose a customer"
                  required
                  error={state.fieldErrors?.offsetCustomerId}
                />
                {selectedCustomer ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {customerBalance?.isPositive()
                      ? `They owe you ${formatMoney(customerBalance, currency)} — this purchase deducts from that.`
                      : customerBalance?.isNegative()
                        ? `You already owe them ${formatMoney(customerBalance.abs(), currency)} — this adds to it.`
                        : 'No balance yet — the full amount will sit on their account for you to pay later.'}
                    {customerBalance && totals.total.greaterThan(customerBalance) && customerBalance.isPositive()
                      ? ` Remainder ${formatMoney(totals.total.minus(customerBalance), currency)} stays as credit on their account.`
                      : null}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Buy items from their shop or settle a cost against what they owe you. Pay any leftover later from the bank or with a journal.
                  </p>
                )}
              </Field>
            ) : (
              <Field
                name="vendorId"
                label="Vendor name"
                required={!vendorOptional}
                error={state.fieldErrors?.vendorId}
              >
                <EntityPicker
                  id="vendorId"
                  kind="vendor"
                  options={vendors}
                  value={vendorId || null}
                  onChange={(next) => chooseVendor(next ?? '')}
                  placeholder={vendorOptional ? 'Optional — choose later for RFQ' : 'Choose a vendor'}
                  required={!vendorOptional}
                  error={state.fieldErrors?.vendorId}
                />
              </Field>
            )}
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
            {showField('reference') ? (
              <Field name="reference" label="PO" error={state.fieldErrors?.reference}>
                <Input
                  {...fieldProps('reference', state.fieldErrors?.reference, true)}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="PO / bill no."
                />
              </Field>
            ) : null}
          </div>

          {showField('project') && (projects.length > 0 || projectId) ? (
            <Field name="projectId" label="Project" error={state.fieldErrors?.projectId}>
              <EntityPicker
                id="projectId"
                options={projects}
                value={projectId || null}
                onChange={(next) => setProjectId(next ?? '')}
                placeholder="Link a job"
                clearable
                emptyMessage="No open projects"
                error={state.fieldErrors?.projectId}
              />
            </Field>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {owed && showField('paymentTerms') ? (
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
            {isExpense ? (
              <Field name="paymentSource" label="Paid from" required>
                <NativeSelect
                  id="paymentSource"
                  value={paymentSource}
                  onChange={(event) => {
                    const next = event.target.value === 'customer' ? 'customer' : 'bank'
                    setPaymentSource(next)
                    if (next === 'bank') setOffsetCustomerId('')
                    else setPaymentAccountId('')
                  }}
                >
                  <option value="bank">Bank / cash</option>
                  <option value="customer">Customer balance</option>
                </NativeSelect>
              </Field>
            ) : null}
            {config.needsPaymentAccount && !payFromCustomer ? (
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
                    style={{ background: isVendorCredit ? VENDOR_CREDIT.band : FORM_SHEET.band }}
                  >
                    <th className="w-64 px-2 py-2 text-left">Category</th>
                    {showCategoryColumn('description') ? (
                      <th className="px-2 py-2 text-left">Description</th>
                    ) : null}
                    {showTax && showCategoryColumn('tax') ? (
                      <th className="w-36 px-2 py-2 text-left">Tax</th>
                    ) : null}
                    <th className="w-32 px-2 py-2 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {categoryLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          2 +
                          (showCategoryColumn('description') ? 1 : 0) +
                          (showTax && showCategoryColumn('tax') ? 1 : 0)
                        }
                        className="px-3 py-4 text-sm text-muted-foreground"
                      >
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
                      {showCategoryColumn('description') ? (
                        <td className="px-2 py-1.5">
                          <Input
                            aria-label="Description"
                            value={line.description}
                            onChange={(event) => update(line.key, { description: event.target.value })}
                          />
                        </td>
                      ) : null}
                      {showTax && showCategoryColumn('tax') ? (
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
                  style={{ background: isVendorCredit ? VENDOR_CREDIT.band : FORM_SHEET.band }}
                >
                <th className="w-44 px-2 py-2 text-left">Item</th>
                {showColumn('description') ? <th className="px-2 py-2 text-left">Description</th> : null}
                {showColumn('qty') ? <th className="w-24 px-2 py-2 text-center">Qty</th> : null}
                {showColumn('rate') ? <th className="w-28 px-2 py-2 text-right">Rate</th> : null}
                {showTax && showColumn('tax') ? <th className="w-36 px-2 py-2 text-left">Tax</th> : null}
                <th className="w-28 px-2 py-2 text-right">Amount</th>
                {showColumn('store') && stores.length > 0 ? (
                  <th className="w-40 px-2 py-2 text-left">Store</th>
                ) : null}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {itemLines.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      3 +
                      (showColumn('description') ? 1 : 0) +
                      (showColumn('qty') ? 1 : 0) +
                      (showColumn('rate') ? 1 : 0) +
                      (showTax && showColumn('tax') ? 1 : 0) +
                      (showColumn('store') && stores.length > 0 ? 1 : 0)
                    }
                    className="px-3 py-4 text-sm text-muted-foreground"
                  >
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
                    {showColumn('description') ? (
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label="Description"
                          value={line.description}
                          onChange={(event) => update(line.key, { description: event.target.value })}
                        />
                      </td>
                    ) : null}
                    {showColumn('qty') ? (
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            aria-label="Quantity"
                            inputMode="decimal"
                            className="min-w-0 flex-1 tabular text-right"
                            value={line.quantity}
                            onChange={(event) => update(line.key, { quantity: event.target.value })}
                          />
                          {line.itemId ? (
                            <span
                              className="w-9 shrink-0 truncate text-center text-[0.65rem] font-medium uppercase text-muted-foreground"
                              title={resolveUnit(itemById.get(line.itemId)?.unitOfMeasure)}
                            >
                              {resolveUnit(itemById.get(line.itemId)?.unitOfMeasure)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                    {showColumn('rate') ? (
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label="Unit cost"
                          inputMode="decimal"
                          className="tabular text-right"
                          value={line.unitPrice}
                          onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                        />
                      </td>
                    ) : null}
                    {showTax && showColumn('tax') ? (
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
                    {showColumn('store') && stores.length > 0 ? (
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
                            if (items.length <= itemRows) {
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
        <Button type="button" variant="outline" onClick={resetForm}>
          Reset
        </Button>
        <SubmitButton
          variant="outline"
          disabled={!canDraft}
          pendingLabel="Saving draft…"
          title="Save without posting — finish and post later from Drafts"
          onClick={() => {
            afterSave.current = 'close'
            saveAsDraft.current = true
          }}
        >
          Save as draft
        </SubmitButton>
        <SubmitButton
          variant="outline"
          disabled={!canSave}
          pendingLabel="Saving…"
          onClick={() => {
            afterSave.current = 'close'
            saveAsDraft.current = false
          }}
        >
          Save and close
        </SubmitButton>
        <SubmitButton
          disabled={!canSave}
          pendingLabel="Saving…"
          onClick={() => {
            afterSave.current = 'new'
            saveAsDraft.current = false
          }}
        >
          Save and new
        </SubmitButton>
      </div>

    </form>
  )
}

const lineInput =
  'h-7 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-ring focus-visible:bg-muted/40'

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
