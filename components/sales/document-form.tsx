'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ImageIcon,
  LayoutTemplateIcon,
  PlusIcon,
  PrinterIcon,
  SaveIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

import { FromQuotationPicker, type OpenQuotationOption } from '@/components/sales/from-quotation'
import { idleState, type FormState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { PartyInfo } from '@/components/forms/party-info'
import { LockedNumber } from '@/components/forms/locked-number'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { AccountPickerOption } from '@/lib/account-options'
import {
  DEFAULT_SALES_FORM_TEMPLATE,
  INVOICE_FORM_TEMPLATES,
  INVOICE_FORM_TEMPLATE_STORAGE_KEY,
  isInvoiceFormTemplateId,
  isSalesFormTemplateId,
  isSalesReceiptFormTemplateId,
  SALES_FORM_TEMPLATE_STORAGE_KEY,
  SALES_FORM_TEMPLATES,
  SALES_RECEIPT_FORM_TEMPLATES,
  SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY,
  type InvoiceFormTemplateId,
  type SalesFormTemplateId,
  type SalesReceiptFormTemplateId,
} from '@/lib/sales-form-templates'
import { formatDate, isCalendarDate } from '@/lib/date'
import { dueDateFor } from '@/lib/payment-terms'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { defaultLineRows, type SalesTypeConfig } from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import { LineStore } from '@/components/inventory/line-store'
import { SheetMarks } from '@/components/sales/sheet-marks'
import { officeStoreId, type StockByStore, type StoreChoice } from '@/lib/store-stock'
import { findSalesReceipts, saveDocumentForm } from '@/app/(app)/sales/actions'

export type ItemOption = {
  id: string
  label: string
  price: string | null
  description: string | null
  taxCodeId: string | null
  type?: string
  group?: string
  onHand?: string | null
  sku?: string | null
}
export type Option = { id: string; label: string }
export type CustomerOption = Option & {
  email: string | null
  paymentTermId: string | null
  billingAddress: string
  shippingAddress: string
}
export type TermOption = Option & {
  type: 'DUE_ON_RECEIPT' | 'NET_DAYS' | 'DAY_OF_MONTH'
  dueDays: number
}
export type TaxOption = Option & { rate: number; isInclusive: boolean }

type Line = {
  key: number
  itemId: string
  description: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxCodeId: string
  storeId: string
}

const empty = (key: number, storeId = ''): Line => ({
  key,
  itemId: '',
  description: '',
  quantity: '',
  unitPrice: '',
  discountPercent: '',
  taxCodeId: '',
  storeId,
})

function withMinimumLines(seeded: Line[], minimum: number, storeId: string): Line[] {
  const rows = [...seeded]
  let key = rows.reduce((max, line) => Math.max(max, line.key), 0)
  while (rows.length < minimum) {
    key += 1
    rows.push(empty(key, storeId))
  }
  return rows
}

type DocumentSeed = {
  id: string
  customerId: string
  date: string
  reference: string | null
  memo: string | null
  customerMessage: string | null
  paymentTermId: string | null
  depositAccountId: string | null
  discountAmount?: string | null
  lines: {
    itemId: string | null
    description: string | null
    quantity: string
    unitPrice: string
    discountPercent: string | null
    taxCodeId: string | null
    storeId?: string | null
  }[]
}

type FormTemplateId = InvoiceFormTemplateId | SalesReceiptFormTemplateId

function sharedLineDiscount(document: DocumentSeed | undefined): string {
  const values = (document?.lines ?? []).map((line) => line.discountPercent).filter((value): value is string => Boolean(value))
  if (values.length === 0 || values.some((value) => value !== values[0])) return ''
  return values[0] ?? ''
}

/**
 * One form for every customer-facing document. The type decides the wording and
 * where money goes; the template only rearranges the sheet. The choice is
 * remembered in this browser.
 */
export function DocumentForm({
  config,
  customers,
  items,
  taxCodes,
  depositAccounts,
  terms,
  today,
  currency,
  organizationName,
  document,
  documentNumber,
  initialCustomerId,
  initialStoreId,
  neighbors,
  stores = [],
  stock = {},
  openQuotations = [],
}: {
  config: SalesTypeConfig
  customers: CustomerOption[]
  items: ItemOption[]
  taxCodes: TaxOption[]
  depositAccounts: AccountPickerOption[]
  terms: TermOption[]
  today: string
  currency: string
  organizationName: string
  /** The number this document has, or the next one if it has not been saved. */
  documentNumber: string
  document?: DocumentSeed
  /** Set when the form was opened from a customer, so the sale starts on them. */
  initialCustomerId?: string
  /** Set when the form was opened from a store, so lines issue from that shelf. */
  initialStoreId?: string
  /** Sales receipts only: the saved receipt before this one, and the one after. */
  neighbors?: {
    previous: { id: string; number: string } | null
    next: { id: string; number: string } | null
  }
  /** Stores a line can be issued from. The office is the default. */
  stores?: StoreChoice[]
  /** Quantity of each tracked item in each store. */
  stock?: StockByStore
  /** Open quotations a new invoice can be created from. */
  openQuotations?: OpenQuotationOption[]
}) {
  const officeId = officeStoreId(stores)
  const defaultStoreId =
    initialStoreId && stores.some((store) => store.id === initialStoreId) ? initialStoreId : officeId
  const router = useRouter()
  const [state, formAction] = useActionState(saveDocumentForm, idleState)
  // Quotation uses the same sheet and template choice as invoice — one form,
  // one look — so switching between the two does not rearrange the page.
  const usesInvoiceSheet = config.type === 'INVOICE' || config.type === 'ESTIMATE'
  const templateKey = usesInvoiceSheet
    ? INVOICE_FORM_TEMPLATE_STORAGE_KEY
    : config.type === 'SALES_RECEIPT'
      ? SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY
      : SALES_FORM_TEMPLATE_STORAGE_KEY
  const [template, setTemplate] = useState<FormTemplateId>(
    usesInvoiceSheet || config.type === 'SALES_RECEIPT' ? 'invoice' : DEFAULT_SALES_FORM_TEMPLATE,
  )
  const savedDiscount = Number(document?.discountAmount ?? 0)
  const liftedPercent =
    config.type === 'SALES_RECEIPT' && savedDiscount <= 0 ? sharedLineDiscount(document) : ''
  const [discountKind, setDiscountKind] = useState<'amount' | 'percent'>(savedDiscount > 0 ? 'amount' : 'percent')
  const [discountValue, setDiscountValue] = useState(savedDiscount > 0 ? savedDiscount.toFixed(2) : liftedPercent)

  const [number, setNumber] = useState(documentNumber)
  const [customerId, setCustomerId] = useState(document?.customerId ?? initialCustomerId ?? '')
  const [date, setDate] = useState(document?.date ?? today)
  const [reference, setReference] = useState(document?.reference ?? '')
  const [memo, setMemo] = useState(document?.memo ?? '')
  const [customerMessage, setCustomerMessage] = useState(document?.customerMessage ?? '')
  const [paymentTermId, setPaymentTermId] = useState(document?.paymentTermId ?? '')
  const [depositAccountId, setDepositAccountId] = useState(
    document?.depositAccountId ?? depositAccounts[0]?.id ?? '',
  )
  const minimumLines = defaultLineRows(config.type)
  const [lines, setLines] = useState<Line[]>(() =>
    withMinimumLines(
      document?.lines.length
        ? document.lines.map((line, index) => ({
            key: index + 1,
            itemId: line.itemId ?? '',
            description: line.description ?? '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: liftedPercent ? '' : (line.discountPercent ?? ''),
            taxCodeId: line.taxCodeId ?? '',
            storeId: line.storeId ?? defaultStoreId,
          }))
        : [],
      minimumLines,
      defaultStoreId,
    ),
  )
  const nextKey = useRef(Math.max(document?.lines.length ?? 0, minimumLines) + 1)
  const handled = useRef(false)
  const afterSave = useRef<'close' | 'new'>('close')

  useEffect(() => setNumber(documentNumber), [documentNumber])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(templateKey)
      const known =
        usesInvoiceSheet
          ? isInvoiceFormTemplateId(stored ?? '')
          : config.type === 'SALES_RECEIPT'
            ? isSalesReceiptFormTemplateId(stored ?? '')
            : isSalesFormTemplateId(stored ?? '')
      if (stored && known) setTemplate(stored as FormTemplateId)
    } catch {
      // Private mode — keep the default.
    }
  }, [templateKey, config.type, usesInvoiceSheet])

  useEffect(() => {
    try {
      window.localStorage.setItem(templateKey, template)
    } catch {
      // Ignore quota / private mode.
    }
  }, [template, templateKey])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      if (afterSave.current === 'new' && !document?.id) {
        setCustomerId(initialCustomerId ?? '')
        setDate(today)
        setReference('')
        setMemo('')
        setCustomerMessage('')
        setPaymentTermId('')
        setDepositAccountId(depositAccounts[0]?.id ?? '')
        setDiscountKind('percent')
        setDiscountValue('')
        setLines(Array.from({ length: minimumLines }, (_, index) => empty(index + 1, defaultStoreId)))
        nextKey.current = minimumLines + 1
        router.refresh()
        return
      }
      router.push(
        afterSave.current === 'new' ? `/sales/${config.slug}/new` : `/sales/${config.slug}`,
      )
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, config.slug, document?.id, initialCustomerId, today, depositAccounts, minimumLines, defaultStoreId])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const trackedIds = useMemo(
    () => items.filter((item) => item.type === 'INVENTORY').map((item) => item.id),
    [items],
  )
  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: item.label,
        group: item.group,
        hint: [item.sku, item.onHand != null ? `${item.onHand} on hand` : null].filter(Boolean).join(' · ') || undefined,
      })),
    [items],
  )
  const taxById = useMemo(() => new Map(taxCodes.map((code) => [code.id, code])), [taxCodes])
  const showTax = taxCodes.length > 0

  const offersDocumentDiscount = config.type === 'INVOICE' || config.type === 'SALES_RECEIPT'

  const totals = useMemo(() => {
    let netSubtotal = ZERO
    let tax = ZERO

    for (const line of lines) {
      const quantity = parseMoneyInput(line.quantity) ?? ZERO
      const price = parseMoneyInput(line.unitPrice) ?? ZERO
      if (quantity.isZero() && price.isZero()) continue

      const gross = quantity.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const discountPercent = parseMoneyInput(line.discountPercent) ?? ZERO
      const lineDiscount = gross.times(discountPercent).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const amount = gross.minus(lineDiscount)

      const code = line.taxCodeId ? taxById.get(line.taxCodeId) : null
      if (!code) {
        netSubtotal = netSubtotal.plus(amount)
        continue
      }

      if (code.isInclusive) {
        const net = amount.dividedBy(new Decimal(1).plus(code.rate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        netSubtotal = netSubtotal.plus(net)
        tax = tax.plus(amount.minus(net))
      } else {
        netSubtotal = netSubtotal.plus(amount)
        tax = tax.plus(amount.times(code.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
      }
    }

    const raw = parseMoneyInput(discountValue) ?? ZERO
    let discount = ZERO
    if (offersDocumentDiscount && raw.greaterThan(0) && netSubtotal.greaterThan(0)) {
      discount =
        discountKind === 'percent'
          ? netSubtotal.times(Decimal.min(raw, new Decimal(100))).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          : Decimal.min(raw, netSubtotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    }
    const ratio = netSubtotal.isZero() ? ZERO : netSubtotal.minus(discount).dividedBy(netSubtotal)
    const taxAfter = tax.times(ratio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

    return {
      subtotal: netSubtotal,
      discount,
      tax: taxAfter,
      total: netSubtotal.minus(discount).plus(taxAfter),
    }
  }, [lines, taxById, offersDocumentDiscount, discountKind, discountValue])

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  const chooseItem = (key: number, itemId: string) => {
    const item = itemId ? itemById.get(itemId) : null
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

  const addLines = (count = 1) =>
    setLines((current) => [
      ...current,
      ...Array.from({ length: count }, () => empty(nextKey.current++, defaultStoreId)),
    ])
  const addLine = () => addLines(1)
  const clearLines = () => {
    setLines(Array.from({ length: minimumLines }, (_, index) => empty(index + 1, defaultStoreId)))
    nextKey.current = minimumLines + 1
  }
  const removeLine = (key: number) =>
    setLines((current) => {
      if (current.length <= minimumLines) {
        return current.map((line) => (line.key === key ? empty(line.key, defaultStoreId) : line))
      }
      return current.filter((line) => line.key !== key)
    })

  const filled = lines.filter(
    (line) => line.itemId || line.description || parseMoneyInput(line.unitPrice)?.greaterThan(0),
  )

  const payloadFor = (saveAsDraft: boolean) =>
    JSON.stringify({
      ...(document?.id ? { id: document.id } : { type: config.type }),
      number,
      customerId,
      date,
      reference,
      memo,
      customerMessage,
      paymentTermId,
      depositAccountId: config.needsDeposit ? depositAccountId : '',
      saveAsDraft,
      ...(offersDocumentDiscount ? { discountKind, discountValue } : {}),
      lines: filled.map((line) => ({
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity || '1',
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        taxCodeId: line.taxCodeId,
        storeId: line.storeId,
      })),
    })

  const [saveAsDraft, setSaveAsDraft] = useState(false)
  const canSave = customerId !== '' && filled.length > 0 && totals.total.greaterThan(0)

  const shared = {
    config,
    state,
    customers,
    itemOptions,
    taxCodes,
    depositAccounts,
    terms,
    today,
    currency,
    organizationName,
    documentNumber,
    number,
    setNumber,
    recordId: document?.id,
    showTax,
    customerId,
    setCustomerId,
    date,
    setDate,
    reference,
    setReference,
    memo,
    setMemo,
    customerMessage,
    setCustomerMessage,
    paymentTermId,
    setPaymentTermId,
    depositAccountId,
    setDepositAccountId,
    lines,
    stores,
    stock,
    trackedIds,
    update,
    chooseItem,
    addLine,
    addLines,
    clearLines,
    removeLine,
    totals,
    discountKind,
    setDiscountKind,
    discountValue,
    setDiscountValue,
    openQuotations:
      config.type === 'INVOICE' && !document?.id ? openQuotations : [],
  }

  return (
    <form
      action={formAction}
      className={
        config.type === 'SALES_RECEIPT' ? 'mx-auto w-full max-w-5xl space-y-4' : 'space-y-4'
      }
    >
      <input type="hidden" name="payload" value={payloadFor(saveAsDraft)} />

      {config.type === 'SALES_RECEIPT' ? (
        <SalesReceiptToolbar
          slug={config.slug}
          recordId={document?.id}
          next={neighbors?.next ?? null}
          canSave={canSave}
          onSave={() => {
            afterSave.current = 'close'
            setSaveAsDraft(false)
          }}
        />
      ) : null}

      {usesInvoiceSheet ? (
        <TemplateMenu options={INVOICE_FORM_TEMPLATES} value={template} onChange={setTemplate} />
      ) : config.type === 'SALES_RECEIPT' ? (
        <TemplateMenu options={SALES_RECEIPT_FORM_TEMPLATES} value={template} onChange={setTemplate} />
      ) : (
        <TemplatePicker value={template as SalesFormTemplateId} onChange={setTemplate} />
      )}
      {template === 'invoice' ? <InvoiceLayout {...shared} /> : null}
      {template === 'classic' ? <ClassicLayout {...shared} /> : null}
      {template === 'service' ? <ServiceLayout {...shared} /> : null}
      {template === 'modern' ? <ModernLayout {...shared} /> : null}
      {template === 'sheet' ? <SheetLayout {...shared} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button type="button" variant="outline" onClick={() => router.push(`/sales/${config.slug}`)}>
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

      <p className="text-right text-xs text-muted-foreground print:hidden">{config.effect}</p>
    </form>
  )
}

function TemplateMenu({
  options,
  value,
  onChange,
}: {
  options: readonly { id: string; label: string; blurb: string }[]
  value: string
  onChange: (next: FormTemplateId) => void
}) {
  const current = options.find((option) => option.id === value)

  return (
    <div className="flex justify-end print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <LayoutTemplateIcon />
            {current?.label ?? 'Template'}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => onChange(option.id as FormTemplateId)}
              className="items-start py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.blurb}</span>
              </span>
              {option.id === value ? <CheckIcon className="mt-0.5" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TemplatePicker({
  value,
  onChange,
}: {
  value: SalesFormTemplateId
  onChange: (next: SalesFormTemplateId) => void
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:hidden sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <LayoutTemplateIcon className="size-4 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-800">Form template</p>
          <p className="text-xs text-slate-500">Change the layout — the numbers and posting stay the same.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {SALES_FORM_TEMPLATES.map((option) => {
          const active = option.id === value
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition',
                active
                  ? 'border-primary bg-sky-50 ring-2 ring-primary/20'
                  : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{option.label}</span>
                {active ? <CheckIcon className="size-4 text-primary" aria-hidden /> : null}
              </span>
              <span className="mt-1 block text-[0.7rem] leading-snug text-slate-500">{option.blurb}</span>
              <TemplateThumb kind={option.id} active={active} />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TemplateThumb({ kind, active }: { kind: SalesFormTemplateId; active: boolean }) {
  return (
    <span
      className={cn(
        'mt-3 block h-14 overflow-hidden rounded-lg border',
        active ? 'border-primary/25 bg-white' : 'border-slate-200 bg-white',
      )}
      aria-hidden
    >
      {kind === 'classic' ? (
        <span className="flex h-full flex-col gap-1 p-2">
          <span className="h-2 w-full rounded bg-slate-200" />
          <span className="h-2 w-[80%] rounded bg-slate-100" />
          <span className="mt-auto grid grid-cols-4 gap-1">
            <span className="h-1.5 rounded bg-slate-200" />
            <span className="h-1.5 rounded bg-slate-200" />
            <span className="h-1.5 rounded bg-slate-200" />
            <span className="h-1.5 rounded bg-slate-200" />
          </span>
        </span>
      ) : null}
      {kind === 'service' ? (
        <span className="flex h-full flex-col gap-1 p-2">
          <span className="h-2 w-1/2 rounded bg-teal-200" />
          <span className="h-3 w-full rounded bg-slate-100" />
          <span className="h-3 w-full rounded bg-slate-100" />
        </span>
      ) : null}
      {kind === 'modern' ? (
        <span className="flex h-full flex-col">
          <span className="h-4 bg-primary text-primary-foreground" />
          <span className="flex flex-1 flex-col gap-1 p-2">
            <span className="h-1.5 w-2/3 rounded bg-slate-200" />
            <span className="h-1.5 w-full rounded bg-slate-100" />
            <span className="h-1.5 w-full rounded bg-slate-100" />
          </span>
        </span>
      ) : null}
      {kind === 'sheet' ? (
        <span className="relative flex h-full flex-col bg-white">
          <span className="absolute left-0 top-0 h-5 w-7 bg-[#3DDC97]" />
          <span className="absolute right-2 top-1.5 h-1 w-8 rounded bg-[#1B3A4B]" />
          <span className="mx-2 mt-7 h-2 bg-[#1B3A4B]" />
          <span className="mx-2 mt-1 h-1 rounded bg-slate-100" />
        </span>
      ) : null}
    </span>
  )
}

type LayoutProps = {
  config: SalesTypeConfig
  state: FormState
  customers: CustomerOption[]
  itemOptions: { id: string; label: string; group?: string; hint?: string }[]
  taxCodes: TaxOption[]
  depositAccounts: AccountPickerOption[]
  terms: TermOption[]
  today: string
  currency: string
  organizationName: string
  documentNumber: string
  number: string
  setNumber: (value: string) => void
  recordId?: string
  showTax: boolean
  customerId: string
  setCustomerId: (value: string) => void
  date: string
  setDate: (value: string) => void
  reference: string
  setReference: (value: string) => void
  memo: string
  setMemo: (value: string) => void
  customerMessage: string
  setCustomerMessage: (value: string) => void
  paymentTermId: string
  setPaymentTermId: (value: string) => void
  depositAccountId: string
  setDepositAccountId: (value: string) => void
  lines: Line[]
  stores: StoreChoice[]
  stock: StockByStore
  trackedIds: string[]
  update: (key: number, patch: Partial<Line>) => void
  chooseItem: (key: number, itemId: string) => void
  addLine: () => void
  addLines: (count?: number) => void
  clearLines: () => void
  removeLine: (key: number) => void
  totals: { subtotal: Decimal; discount: Decimal; tax: Decimal; total: Decimal }
  discountKind: 'amount' | 'percent'
  setDiscountKind: (value: 'amount' | 'percent') => void
  discountValue: string
  setDiscountValue: (value: string) => void
  openQuotations: OpenQuotationOption[]
}

function HeaderFields({
  props,
  quantityLabel = 'Qty',
}: {
  props: LayoutProps
  quantityLabel?: string
}) {
  void quantityLabel
  const { config, state, customers, depositAccounts, terms, today } = props

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <LockedNumber
        label={`${config.singular} number`}
        value={props.number}
        onChange={props.setNumber}
        error={state.fieldErrors?.number}
        recordId={props.recordId}
      />

      <Field name="reference" label="PO number" error={state.fieldErrors?.reference}>
        <Input
          {...fieldProps('reference', state.fieldErrors?.reference)}
          value={props.reference}
          onChange={(event) => props.setReference(event.target.value)}
          placeholder="Customer PO"
        />
      </Field>

      <Field name="date" label="Date" required error={state.fieldErrors?.date}>
        <DateField
          id="date"
          value={props.date}
          onChange={props.setDate}
          today={today}
          required
          aria-invalid={state.fieldErrors?.date ? true : undefined}
        />
      </Field>

      <Field name="customerId" label="Customer" required error={state.fieldErrors?.customerId}>
        <EntityPicker
          id="customerId"
          kind="customer"
          options={customers}
          value={props.customerId || null}
          onChange={(next) => props.setCustomerId(next ?? '')}
          placeholder="Search or add a customer"
          required
          error={state.fieldErrors?.customerId}
        />
      </Field>

      {config.type === 'INVOICE' ? (
        <Field
          name="paymentTermId"
          label="Terms"
          hint="Sets the due date from this document's own date."
          error={state.fieldErrors?.paymentTermId}
        >
          <NativeSelect
            {...fieldProps('paymentTermId', state.fieldErrors?.paymentTermId, true)}
            value={props.paymentTermId}
            onChange={(event) => props.setPaymentTermId(event.target.value)}
          >
            <option value="">Customer&rsquo;s default</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}

      {config.needsDeposit ? (
        <Field
          name="depositAccountId"
          label={config.type === 'REFUND_RECEIPT' ? 'Paid from' : 'Deposit to'}
          required
          error={state.fieldErrors?.depositAccountId}
        >
          <AccountPicker
            id="depositAccountId"
            options={depositAccounts}
            value={props.depositAccountId || null}
            onChange={(next) => props.setDepositAccountId(next ?? '')}
            required
            error={state.fieldErrors?.depositAccountId}
          />
        </Field>
      ) : null}
    </div>
  )
}

function DiscountControl({ props }: { props: LayoutProps }) {
  if (props.config.type !== 'INVOICE' && props.config.type !== 'SALES_RECEIPT') return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-muted-foreground">Discount</span>
      <span className="inline-flex overflow-hidden rounded-md border border-primary/30">
        <button
          type="button"
          className={`px-2 py-1 text-xs ${props.discountKind === 'amount' ? 'bg-primary text-primary-foreground' : 'text-primary'}`}
          onClick={() => props.setDiscountKind('amount')}
        >
          Amount
        </button>
        <button
          type="button"
          className={`px-2 py-1 text-xs ${props.discountKind === 'percent' ? 'bg-primary text-primary-foreground' : 'text-primary'}`}
          onClick={() => props.setDiscountKind('percent')}
        >
          %
        </button>
      </span>
      <Input
        value={props.discountValue}
        onChange={(event) => props.setDiscountValue(event.target.value)}
        inputMode="decimal"
        aria-label={props.discountKind === 'percent' ? 'Discount percent' : 'Discount amount'}
        className="h-8 w-24 text-right tabular"
        placeholder="0"
      />
      <span className="tabular text-sm">{formatMoney(props.totals.discount, props.currency)}</span>
    </div>
  )
}

function TotalsBlock({ props }: { props: LayoutProps }) {
  return (
    <dl className="min-w-64 space-y-1 text-sm">
      <div className="flex justify-between gap-8">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular">{formatMoney(props.totals.subtotal, props.currency)}</dd>
      </div>
      <div className="py-1">
        <DiscountControl props={props} />
      </div>
      {props.showTax ? (
        <div className="flex justify-between gap-8">
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="tabular">{formatMoney(props.totals.tax, props.currency)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-8 border-t pt-1 font-semibold">
        <dt>Total</dt>
        <dd className="tabular">{formatMoney(props.totals.total, props.currency)}</dd>
      </div>
    </dl>
  )
}

function NotesFields({ props }: { props: LayoutProps }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="customerMessage" label="Message on the document" error={props.state.fieldErrors?.customerMessage}>
        <Input
          {...fieldProps('customerMessage', props.state.fieldErrors?.customerMessage)}
          value={props.customerMessage}
          onChange={(event) => props.setCustomerMessage(event.target.value)}
          placeholder="Thank you for your business"
        />
      </Field>
      <Field name="memo" label="Memo" hint="Write an explanation. It stays on the receipt and is not printed for the customer." error={props.state.fieldErrors?.memo}>
        <textarea
          id="memo"
          name="memo"
          rows={3}
          value={props.memo}
          onChange={(event) => props.setMemo(event.target.value)}
          placeholder="Write an explanation"
          aria-invalid={props.state.fieldErrors?.memo ? true : undefined}
          className="flex min-h-20 w-full rounded-md border border-input bg-card px-2.5 py-2 text-[0.8125rem] transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        />
      </Field>
    </div>
  )
}

function InvoiceLayout(props: LayoutProps) {
  const { state, customers, terms, today } = props
  const customer = customers.find((row) => row.id === props.customerId)
  const termId = props.paymentTermId || customer?.paymentTermId || ''
  const term = terms.find((row) => row.id === termId)
  const due =
    isCalendarDate(props.date)
      ? dueDateFor(props.date, term ? { type: term.type, dueDays: term.dueDays } : null)
      : props.date

  return (
    <Card className="overflow-hidden bg-white p-0">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <FormStatus state={state} />

        <div className="flex flex-wrap items-start justify-between gap-6">
          <PartyInfo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="customerId" label="Customer" required error={state.fieldErrors?.customerId}>
                <EntityPicker
                  id="customerId"
                  kind="customer"
                  options={customers}
                  value={props.customerId || null}
                  onChange={(next) => {
                    const id = next ?? ''
                    props.setCustomerId(id)
                    const chosen = customers.find((row) => row.id === id)
                    props.setPaymentTermId(chosen?.paymentTermId ?? '')
                  }}
                  placeholder="Choose a customer"
                  required
                  error={state.fieldErrors?.customerId}
                />
              </Field>
              <Field name="customerEmail" label="Email">
                <Input id="customerEmail" value={customer?.email ?? ''} readOnly placeholder="No email on this customer" />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <AddressBox label="Billing address" value={customer?.billingAddress ?? ''} empty="No billing address" />
              <AddressBox label="Shipping address" value={customer?.shippingAddress ?? ''} empty="No shipping address" />
            </div>
          </PartyInfo>
          <div className="text-right">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {props.config.needsDeposit
                ? 'Amount received'
                : props.config.type === 'ESTIMATE'
                  ? 'Total'
                  : 'Balance due'}
            </p>
            <p className="text-2xl font-semibold tabular text-primary">{formatMoney(props.totals.total, props.currency)}</p>
          </div>
        </div>

        {props.config.type === 'INVOICE' && !props.recordId ? (
          <FromQuotationPicker
            customerId={props.customerId}
            quotations={props.openQuotations}
            today={today}
            currency={props.currency}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field name="date" label={`${props.config.singular} date`} required error={state.fieldErrors?.date}>
            <DateField
              id="date"
              value={props.date}
              onChange={props.setDate}
              today={today}
              required
              aria-invalid={state.fieldErrors?.date ? true : undefined}
            />
          </Field>
          {props.config.needsDeposit ? (
            <Field
              name="depositAccountId"
              label={props.config.type === 'REFUND_RECEIPT' ? 'Paid from' : 'Deposit to'}
              required
              error={state.fieldErrors?.depositAccountId}
            >
              <AccountPicker
                id="depositAccountId"
                options={props.depositAccounts}
                value={props.depositAccountId || null}
                onChange={(next) => props.setDepositAccountId(next ?? '')}
                required
                error={state.fieldErrors?.depositAccountId}
              />
            </Field>
          ) : (
            <Field name="paymentTermId" label="Terms" error={state.fieldErrors?.paymentTermId}>
              <NativeSelect
                {...fieldProps('paymentTermId', state.fieldErrors?.paymentTermId)}
                value={props.paymentTermId}
                onChange={(event) => props.setPaymentTermId(event.target.value)}
              >
                <option value="">Due on receipt</option>
                {terms.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {props.config.needsDeposit ? null : (
            <Field name="dueDate" label={props.config.type === 'ESTIMATE' ? 'Valid until' : 'Due date'}>
              <Input id="dueDate" value={isCalendarDate(due) ? formatDate(due) : ''} readOnly />
            </Field>
          )}
          <LockedNumber
            label={`${props.config.singular} no.`}
            value={props.number}
            onChange={props.setNumber}
            error={state.fieldErrors?.number}
            recordId={props.recordId}
          />
          <Field name="reference" label="P.O. number" error={state.fieldErrors?.reference}>
            <Input
              {...fieldProps('reference', state.fieldErrors?.reference)}
              value={props.reference}
              onChange={(event) => props.setReference(event.target.value)}
            />
          </Field>
        </div>

        <InvoiceLines props={props} />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-4">
            <Field name="customerMessage" label={`Message on ${props.config.singular.toLowerCase()}`} error={state.fieldErrors?.customerMessage}>
              <textarea
                id="customerMessage"
                name="customerMessage"
                rows={3}
                value={props.customerMessage}
                onChange={(event) => props.setCustomerMessage(event.target.value)}
                placeholder="Thank you for your business"
                className={noteBox}
              />
            </Field>
            <Field
              name="memo"
              label="Message on statement"
              hint="Stays with the invoice. It is not printed on the customer’s copy."
              error={state.fieldErrors?.memo}
            >
              <textarea
                id="memo"
                name="memo"
                rows={3}
                value={props.memo}
                onChange={(event) => props.setMemo(event.target.value)}
                className={noteBox}
              />
            </Field>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">{formatMoney(props.totals.subtotal, props.currency)}</dd>
            </div>
            <DiscountControl props={props} />
            {props.showTax ? (
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular">{formatMoney(props.totals.tax, props.currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-6 border-t pt-2 font-medium">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(props.totals.total, props.currency)}</dd>
            </div>
            <div className="flex justify-between gap-6 text-base font-semibold">
              <dt>
                {props.config.needsDeposit
                  ? 'Amount received'
                  : props.config.type === 'ESTIMATE'
                    ? 'Total'
                    : 'Balance due'}
              </dt>
              <dd className="tabular text-primary">{formatMoney(props.totals.total, props.currency)}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}

function AddressBox({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="min-h-24 whitespace-pre-line rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
        {value || <span className="text-muted-foreground">{empty}</span>}
      </div>
    </div>
  )
}

const noteBox =
  'flex min-h-20 w-full rounded-md border border-input bg-card px-2.5 py-2 text-[0.8125rem] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25'

function InvoiceLines({ props }: { props: LayoutProps }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="ledger-head text-[12px] font-semibold uppercase tracking-wide">
              <th className="w-44 px-2 py-2 text-left">Item</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="w-16 px-2 py-2 text-center">Qty</th>
              <th className="w-28 px-2 py-2 text-right">Rate</th>
              <th className="w-28 px-2 py-2 text-right">Amount</th>
              {props.stores.length > 0 ? <th className="w-40 px-2 py-2 text-left">Store</th> : null}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {props.lines.map((line, index) => (
              <tr key={line.key} className={index % 2 === 0 ? 'ledger-row' : 'ledger-row-alt'}>
                <td className="px-1 py-1">
                  <EntityPicker
                    kind="item"
                    options={props.itemOptions}
                    value={line.itemId || null}
                    onChange={(next) => props.chooseItem(line.key, next ?? '')}
                    placeholder="Item"
                    clearable
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Description, line ${index + 1}`}
                    className={lineInput}
                    value={line.description}
                    onChange={(event) => props.update(line.key, { description: event.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Quantity, line ${index + 1}`}
                    inputMode="decimal"
                    className={cn(lineInput, 'tabular text-center')}
                    value={line.quantity}
                    onChange={(event) => props.update(line.key, { quantity: event.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Rate, line ${index + 1}`}
                    inputMode="decimal"
                    className={cn(lineInput, 'tabular text-right')}
                    value={line.unitPrice}
                    onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <AmountField line={line} onCommit={(next) => props.update(line.key, next)} />
                </td>
                {props.stores.length > 0 ? (
                  <td className="px-1 py-1 align-top">
                    <LineStore
                      stores={props.stores}
                      stock={props.stock}
                      tracked={props.trackedIds.includes(line.itemId)}
                      warn={props.config.type === 'INVOICE' || props.config.type === 'SALES_RECEIPT'}
                      itemId={line.itemId}
                      storeId={line.storeId}
                      quantity={line.quantity}
                      onChange={(storeId) => props.update(line.key, { storeId })}
                      label={`Store, line ${index + 1}`}
                    />
                  </td>
                ) : null}
                <td className="px-0.5 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Clear line ${index + 1}`}
                    onClick={() => props.removeLine(line.key)}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={props.addLine}>
        <PlusIcon /> Add line
      </Button>
    </div>
  )
}

function SheetLayout(props: LayoutProps) {
  return (
    <Card className="relative overflow-hidden bg-white p-0">
      <SheetMarks />
      <CardContent className="relative space-y-6 px-5 py-8 sm:px-8">
        <div className="text-right">
          <p className="text-xl font-bold uppercase tracking-[0.04em] text-[#1B3A4B] sm:text-2xl">
            {props.organizationName}
          </p>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#0E8A6A]">
            {props.config.singular}
          </p>
        </div>

        <FormStatus state={props.state} />
        <div className="[&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-[0.12em] [&_label]:text-[#0E8A6A]">
          <HeaderFields props={props} />
        </div>

        {props.config.type === 'INVOICE' && !props.recordId ? (
          <FromQuotationPicker
            customerId={props.customerId}
            quotations={props.openQuotations}
            today={props.today}
            currency={props.currency}
          />
        ) : null}

        <StripedLines props={props} />

        <NotesFields props={props} />
      </CardContent>
    </Card>
  )
}

const SALES_COLUMNS = [
  { key: 'item', label: 'Item', width: 360, min: 220 },
  { key: 'description', label: 'Description', width: 220, min: 120 },
  { key: 'qty', label: 'Qty', width: 72, min: 56 },
  { key: 'price', label: 'Unit price', width: 120, min: 80 },
  { key: 'total', label: 'Line total', width: 120, min: 80 },
] as const

const SALES_COLUMN_STORAGE_KEY = 'bpc.salesReceiptColumns'
const SALES_LOGO_STORAGE_KEY = 'bpc.salesLogo'

type SalesColumnKey = (typeof SALES_COLUMNS)[number]['key']

function SalesReceiptToolbar({
  slug,
  recordId,
  next,
  canSave,
  onSave,
}: {
  slug: string
  recordId?: string
  next: { id: string; number: string } | null
  canSave: boolean
  onSave: () => void
}) {
  const router = useRouter()
  const forwardHref = next ? `/sales/${slug}/${next.id}/edit` : recordId ? `/sales/${slug}/new` : null

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-background p-1.5 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!forwardHref}
        title={next ? `Forward to ${next.number}` : recordId ? 'Forward to a new receipt' : 'No later receipt'}
        onClick={() => forwardHref && router.push(forwardHref)}
      >
        Forward
        <ChevronRightIcon />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (recordId) router.push(`/sales/${slug}/${recordId}/print`)
          else window.print()
        }}
      >
        <PrinterIcon />
        Print
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/sales/${slug}/new`)}>
        <PlusIcon />
        New
      </Button>
      <ReceiptFinder slug={slug} />
      <Button type="submit" size="sm" disabled={!canSave} onClick={onSave}>
        <SaveIcon />
        Save
      </Button>
    </div>
  )
}

function ReceiptFinder({ slug }: { slug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [rows, setRows] = useState<
    { id: string; number: string; date: string; total: string; currencyCode: string; customerName: string }[]
  >([])
  const [searched, setSearched] = useState(false)

  async function search(next?: { number?: string; date?: string; amount?: string }) {
    const result = await findSalesReceipts({
      number: next?.number ?? number,
      date: next?.date ?? date,
      amount: next?.amount ?? amount,
    })
    setRows(result.ok ? result.data : [])
    setSearched(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void search({ number: '', date: '', amount: '' })
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SearchIcon />
          Find
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Find a sales receipt</DialogTitle>
          <DialogDescription>Search by the receipt number, the date, or the amount.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3">
          <Field name="findNumber" label="Sales number">
            <Input
              id="findNumber"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="SR-00001"
              autoComplete="off"
            />
          </Field>
          <Field name="findDate" label="Date">
            <Input id="findDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field name="findAmount" label="Amount">
            <Input
              id="findAmount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="100"
              autoComplete="off"
            />
          </Field>
          <Button type="button" onClick={() => void search()}>
            <SearchIcon />
            Find
          </Button>
        </div>
        <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  setOpen(false)
                  router.push(`/sales/${slug}/${row.id}/edit`)
                }}
              >
                <span>
                  <span className="font-medium">{row.number}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.customerName} · {formatDate(row.date)}
                  </span>
                </span>
                <span className="tabular">{formatMoney(row.total, row.currencyCode)}</span>
              </button>
            </li>
          ))}
          {searched && rows.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">No receipt matches.</li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function SalesReceiptLayout(props: LayoutProps) {
  const { config, state, customers, depositAccounts, today } = props

  useEffect(() => {
    if (props.customerId) return
    const timer = window.setTimeout(() => document.getElementById('customerId')?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [props.customerId])

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <FormStatus state={props.state} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field name="customerId" label="Customer name" required error={state.fieldErrors?.customerId}>
            <EntityPicker
              id="customerId"
              kind="customer"
              options={customers}
              value={props.customerId || null}
              onChange={(next) => props.setCustomerId(next ?? '')}
              placeholder="Search or add a customer"
              required
              error={state.fieldErrors?.customerId}
            />
          </Field>
          <Field name="date" label="Date" required error={state.fieldErrors?.date}>
            <DateField
              id="date"
              value={props.date}
              onChange={props.setDate}
              today={today}
              required
              aria-invalid={state.fieldErrors?.date ? true : undefined}
            />
          </Field>
          <Field
            name="depositAccountId"
            label={config.type === 'REFUND_RECEIPT' ? 'Paid from' : 'Deposit to'}
            required
            error={state.fieldErrors?.depositAccountId}
          >
            <AccountPicker
              id="depositAccountId"
              options={depositAccounts}
              value={props.depositAccountId || null}
              onChange={(next) => props.setDepositAccountId(next ?? '')}
              required
              error={state.fieldErrors?.depositAccountId}
            />
          </Field>
          <LockedNumber
            label="Sales receipt"
            value={props.number}
            onChange={props.setNumber}
            error={state.fieldErrors?.number}
            recordId={props.recordId}
          />
        </div>
        <LogoSlot />
      </div>

      <Field name="reference" label="PO number" error={state.fieldErrors?.reference}>
        <Input
          {...fieldProps('reference', state.fieldErrors?.reference)}
          value={props.reference}
          onChange={(event) => props.setReference(event.target.value)}
          placeholder="Customer PO"
          className="max-w-xs"
        />
      </Field>

      <SalesLines props={props} />

      <NotesFields props={props} />
    </section>
  )
}

function LogoSlot() {
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    try {
      setLogo(window.localStorage.getItem(SALES_LOGO_STORAGE_KEY))
    } catch {
      setLogo(null)
    }
  }, [])

  const keep = (value: string | null) => {
    setLogo(value)
    try {
      if (value) window.localStorage.setItem(SALES_LOGO_STORAGE_KEY, value)
      else window.localStorage.removeItem(SALES_LOGO_STORAGE_KEY)
    } catch {
      toast.error('That logo is too large to keep on this browser.')
      setLogo(null)
    }
  }

  return (
    <div className="flex w-40 shrink-0 flex-col items-end gap-1">
      <label className="flex h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500 hover:border-primary hover:text-primary">
        {logo ? (
          // The file is chosen on this browser and kept only here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Company logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-2">
            <ImageIcon className="size-5" aria-hidden />
            Add a logo
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (file.size > 400_000) {
              toast.error('Use a logo under 400 KB.')
              return
            }
            const reader = new FileReader()
            reader.onload = () => keep(String(reader.result ?? ''))
            reader.readAsDataURL(file)
          }}
        />
      </label>
      {logo ? (
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => keep(null)}>
          Remove logo
        </button>
      ) : null}
    </div>
  )
}

function unitPriceFromTotal(
  quantity: string,
  totalText: string,
  discountPercent = '',
): { quantity: string; unitPrice: string } | null {
  if (totalText.trim() === '') return { quantity, unitPrice: '' }
  const total = parseMoneyInput(totalText)
  if (total == null) return null
  const qty = parseMoneyInput(quantity)
  const count = qty && !qty.isZero() ? qty : new Decimal(1)
  const percent = parseMoneyInput(discountPercent) ?? ZERO
  const kept = new Decimal(1).minus(percent.dividedBy(100))
  const gross = kept.isZero() ? total : total.dividedBy(kept)
  const unit = gross.dividedBy(count).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
  return {
    quantity: qty && !qty.isZero() ? quantity : '1',
    unitPrice: unit.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''),
  }
}

function AmountField({
  line,
  onCommit,
}: {
  line: Line
  onCommit: (next: { quantity: string; unitPrice: string }) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const quantity = parseMoneyInput(line.quantity) ?? ZERO
  const price = parseMoneyInput(line.unitPrice) ?? ZERO
  const gross = quantity.times(price)
  const discount = gross.times(parseMoneyInput(line.discountPercent) ?? ZERO).dividedBy(100)
  const amount = quantity.isZero() && price.isZero() ? null : gross.minus(discount)
  const shown =
    draft ??
    (amount
      ? amount.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
      : '')

  return (
    <Input
      aria-label="Amount"
      inputMode="decimal"
      className={cn(lineInput, 'tabular text-right')}
      value={shown}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        const next = unitPriceFromTotal(line.quantity, event.currentTarget.value, line.discountPercent)
        if (next) onCommit(next)
        setDraft(null)
      }}
    />
  )
}

function SalesLines({ props }: { props: LayoutProps }) {
  const [widths, setWidths] = useState<Record<SalesColumnKey, number>>(() => {
    const fallback = Object.fromEntries(SALES_COLUMNS.map((column) => [column.key, column.width])) as Record<
      SalesColumnKey,
      number
    >
    return fallback
  })
  const drag = useRef<{ key: SalesColumnKey; startX: number; startWidth: number } | null>(null)
  const [totalDraft, setTotalDraft] = useState<{ key: number; value: string } | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SALES_COLUMN_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<Record<SalesColumnKey, number>>
      setWidths((current) => {
        const next = { ...current }
        for (const column of SALES_COLUMNS) {
          const value = parsed[column.key]
          if (typeof value === 'number' && value >= column.min) next[column.key] = value
        }
        return next
      })
    } catch {
      // Keep the wide item column.
    }
  }, [])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const active = drag.current
      if (!active) return
      const column = SALES_COLUMNS.find((entry) => entry.key === active.key)
      const min = column?.min ?? 56
      const width = Math.max(min, active.startWidth + event.clientX - active.startX)
      setWidths((current) => ({ ...current, [active.key]: width }))
    }
    const stop = () => {
      if (!drag.current) return
      drag.current = null
      setWidths((current) => {
        try {
          window.localStorage.setItem(SALES_COLUMN_STORAGE_KEY, JSON.stringify(current))
        } catch {
          // The widths still apply for this visit.
        }
        return current
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
  }, [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: SALES_COLUMNS.reduce((sum, column) => sum + widths[column.key], 36) }}>
        <colgroup>
          {SALES_COLUMNS.map((column) => (
            <col key={column.key} style={{ width: widths[column.key] }} />
          ))}
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr className="bg-[#3A7CA8] text-left text-xs font-semibold uppercase tracking-wide text-white">
            {SALES_COLUMNS.map((column) => (
              <th key={column.key} className="relative px-2 py-2 font-semibold">
                {column.label}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${column.label}`}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-white/40"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    drag.current = { key: column.key, startX: event.clientX, startWidth: widths[column.key] }
                  }}
                />
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line, index) => {
            const started = Boolean(line.itemId || line.description || parseMoneyInput(line.unitPrice)?.greaterThan(0))
            const quantity = parseMoneyInput(line.quantity) ?? ZERO
            const price = parseMoneyInput(line.unitPrice) ?? ZERO
            const lineTotal = quantity.isZero() && price.isZero() ? null : quantity.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            return (
              <tr key={line.key} className={index % 2 === 0 ? 'ledger-row' : 'ledger-row-alt'}>
                <td className="px-1 py-1 align-top">
                  <EntityPicker
                    id={`item-${line.key}`}
                    kind="item"
                    options={props.itemOptions}
                    value={line.itemId || null}
                    onChange={(next) => props.chooseItem(line.key, next ?? '')}
                    placeholder="Item"
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <Input
                    value={line.description}
                    onChange={(event) => props.update(line.key, { description: event.target.value })}
                    className={lineInput}
                    aria-label="Description"
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <Input
                    value={line.quantity}
                    onChange={(event) => props.update(line.key, { quantity: event.target.value })}
                    inputMode="decimal"
                    className={cn(lineInput, 'text-right tabular')}
                    aria-label="Qty"
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <Input
                    value={line.unitPrice}
                    onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
                    inputMode="decimal"
                    className={cn(lineInput, 'text-right tabular')}
                    aria-label="Unit price"
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <Input
                    value={totalDraft?.key === line.key ? totalDraft.value : lineTotal ? lineTotal.toFixed(2) : ''}
                    onFocus={() => setTotalDraft({ key: line.key, value: lineTotal ? lineTotal.toFixed(2) : '' })}
                    onChange={(event) => setTotalDraft({ key: line.key, value: event.target.value })}
                    onBlur={(event) => {
                      const next = unitPriceFromTotal(line.quantity, event.target.value, line.discountPercent)
                      if (next) props.update(line.key, next)
                      setTotalDraft(null)
                    }}
                    inputMode="decimal"
                    className={cn(lineInput, 'text-right tabular')}
                    aria-label="Line total"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-1 py-1 align-middle">
                  {started || props.lines.length > defaultLineRows() ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => props.removeLine(line.key)} aria-label="Remove line">
                      <Trash2Icon />
                    </Button>
                  ) : null}
                  {props.showTax && started ? (
                    <NativeSelect
                      value={line.taxCodeId}
                      onChange={(event) => props.update(line.key, { taxCodeId: event.target.value })}
                      aria-label="Tax"
                      className="mt-1 h-7"
                    >
                      <option value="">No tax</option>
                      {props.taxCodes.map((code) => (
                        <option key={code.id} value={code.id}>
                          {code.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-2 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={props.addLine}>
                <PlusIcon />
                Add line
              </Button>
            </td>
            <td className="px-2 pt-3 text-right text-muted-foreground">Subtotal</td>
            <td className="px-2 pt-3 text-right tabular">{formatMoney(props.totals.subtotal, props.currency)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={3} />
            <td className="px-2 py-1 text-right" colSpan={2}>
              <DiscountControl props={props} />
            </td>
            <td />
          </tr>
          {props.showTax ? (
            <tr>
              <td colSpan={3} />
              <td className="px-2 py-1 text-right text-muted-foreground">Tax</td>
              <td className="px-2 py-1 text-right tabular">{formatMoney(props.totals.tax, props.currency)}</td>
              <td />
            </tr>
          ) : null}
          <tr>
            <td colSpan={3} />
            <td className="px-2 py-2 text-right font-semibold">Total</td>
            <td className="border-t px-2 py-2 text-right font-semibold tabular">
              {formatMoney(props.totals.total, props.currency)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ClassicLayout(props: LayoutProps) {
  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <FormStatus state={props.state} />
          <HeaderFields props={props} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="panel-head">
          <h2 className="text-sm font-semibold">Product and service details</h2>
          <span className="text-xs text-muted-foreground">Each line posts to the income account its item names.</span>
        </div>
        <StripedLines props={props} />
      </Card>

      <Card>
        <CardContent className="p-4">
          <NotesFields props={props} />
        </CardContent>
      </Card>
    </>
  )
}

function ServiceLayout(props: LayoutProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-teal-100 bg-gradient-to-r from-teal-50 to-sky-50 px-5 py-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-teal-800/70">
          Service template
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          New {props.config.singular.toLowerCase()}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Built for labour and services — description and hours lead, rates follow.
        </p>
      </div>

      <CardContent className="space-y-5 p-5">
        <FormStatus state={props.state} />
        <HeaderFields props={props} quantityLabel="Hours" />

        <StripedLines props={props} />

        <NotesFields props={props} />
      </CardContent>
    </Card>
  )
}

function ModernLayout(props: LayoutProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-primary px-5 py-5 text-primary-foreground sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
              {props.organizationName}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {props.config.singular}
            </h2>
          </div>
          <p className="max-w-xs text-right text-xs text-primary-foreground/75">{props.config.effect}</p>
        </div>
      </div>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <FormStatus state={props.state} />
        <HeaderFields props={props} />
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-800">Line items</h3>
          </div>
          <StripedLines props={props} />
        </div>
        <NotesFields props={props} />
      </CardContent>
    </Card>
  )
}

const lineInput =
  'h-7 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-[#3A7CA8] focus-visible:bg-white'

/** The line band from a ruled sales sheet: blue head, then pale stripes. */
function StripedLines({ props }: { props: LayoutProps }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-[#3A7CA8] text-white">
              <th className="w-16 px-2 py-2 text-center text-[13px] font-medium">Qty</th>
              <th className="w-44 px-2 py-2 text-left text-[13px] font-medium">Item #</th>
              <th className="px-2 py-2 text-left text-[13px] font-medium">Description</th>
              <th className="w-28 px-2 py-2 text-right text-[13px] font-medium">Unit Price</th>
              <th className="w-24 px-2 py-2 text-right text-[13px] font-medium">Discount</th>
              <th className="w-28 px-2 py-2 text-right text-[13px] font-medium">Line Total</th>
              {props.stores.length > 0 ? (
                <th className="w-40 px-2 py-2 text-left text-[13px] font-medium">Store</th>
              ) : null}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {props.lines.map((line, index) => (
              <tr key={line.key} className={index % 2 === 0 ? 'ledger-row' : 'ledger-row-alt'}>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Quantity, line ${index + 1}`}
                    inputMode="decimal"
                    className={cn(lineInput, 'tabular text-center')}
                    value={line.quantity}
                    onChange={(event) => props.update(line.key, { quantity: event.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <EntityPicker
                    kind="item"
                    options={props.itemOptions}
                    value={line.itemId || null}
                    onChange={(next) => props.chooseItem(line.key, next ?? '')}
                    placeholder="Item #"
                    clearable
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Description, line ${index + 1}`}
                    className={lineInput}
                    value={line.description}
                    onChange={(event) => props.update(line.key, { description: event.target.value })}
                  />
                  {props.showTax && (line.itemId || line.description || line.unitPrice || line.taxCodeId) ? (
                    <NativeSelect
                      aria-label={`Tax, line ${index + 1}`}
                      value={line.taxCodeId}
                      onChange={(event) => props.update(line.key, { taxCodeId: event.target.value })}
                      className="mt-1 h-7 border-transparent bg-transparent px-1 text-xs"
                    >
                      <option value="">No tax</option>
                      {props.taxCodes.map((code) => (
                        <option key={code.id} value={code.id}>
                          {code.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : null}
                </td>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Unit price, line ${index + 1}`}
                    inputMode="decimal"
                    className={cn(lineInput, 'tabular text-right')}
                    value={line.unitPrice}
                    onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    aria-label={`Discount percent, line ${index + 1}`}
                    inputMode="decimal"
                    className={cn(lineInput, 'tabular text-right')}
                    value={line.discountPercent}
                    onChange={(event) => props.update(line.key, { discountPercent: event.target.value })}
                    placeholder="%"
                  />
                </td>
                <td className="px-1 py-1">
                  <AmountField line={line} onCommit={(next) => props.update(line.key, next)} />
                </td>
                {props.stores.length > 0 ? (
                  <td className="px-1 py-1 align-top">
                    <LineStore
                      stores={props.stores}
                      stock={props.stock}
                      tracked={props.trackedIds.includes(line.itemId)}
                      warn={props.config.type === 'INVOICE' || props.config.type === 'SALES_RECEIPT'}
                      itemId={line.itemId}
                      storeId={line.storeId}
                      quantity={line.quantity}
                      onChange={(storeId) => props.update(line.key, { storeId })}
                      label={`Store, line ${index + 1}`}
                    />
                  </td>
                ) : null}
                <td className="px-0.5 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Clear line ${index + 1}`}
                    onClick={() => props.removeLine(line.key)}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <Button type="button" variant="outline" size="sm" onClick={props.addLine}>
          <PlusIcon /> Add line
        </Button>
        <TotalsBlock props={props} />
      </div>
    </div>
  )
}
