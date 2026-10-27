'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import {
  CheckIcon,
  ChevronDownIcon,
  LayoutTemplateIcon,
  PlusIcon,
  PrinterIcon,
  SaveIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  FromSourcePicker,
  type AppliedSource,
  type OpenSourceOption,
} from '@/components/sales/from-source'
import { idleState, type FormState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormCustomizePanel } from '@/components/forms/form-customize-panel'
import { neighborHrefs, RecordNav } from '@/components/forms/record-nav'
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
import { isFieldVisible, isColumnVisible, SALES_FORM_COLUMNS, SALES_FORM_FIELDS } from '@/lib/form-field-catalog'
import type { FormCustomizationProps } from '@/lib/form-customization-props'
import type { FormTemplate } from '@/lib/form-templates'
import {
  DEFAULT_INVOICE_FORM_TEMPLATE,
  DEFAULT_SALES_FORM_TEMPLATE,
  DEFAULT_SALES_RECEIPT_FORM_TEMPLATE,
  INVOICE_FORM_TEMPLATES,
  isInvoiceFormTemplateId,
  isSalesFormTemplateId,
  isSalesReceiptFormTemplateId,
  PRINT_SHEET_SALES_TYPES,
  SALES_FORM_TEMPLATES,
  SALES_RECEIPT_FORM_TEMPLATES,
  type InvoiceFormTemplateId,
  type SalesFormTemplateId,
  type SalesReceiptFormTemplateId,
} from '@/lib/sales-form-templates'
import { formatDate, isCalendarDate } from '@/lib/date'
import { dueDateFor } from '@/lib/payment-terms'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import { resolveUnit } from '@/lib/quantity'
import {
  byType,
  customerPaperTotalLabel,
  defaultLineRows,
  isProposal,
  isSalesOrder,
  type SalesTypeConfig,
} from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import { LineStore } from '@/components/inventory/line-store'
import { StockWarningNote } from '@/components/inventory/stock-warning'
import { SheetMarks } from '@/components/sales/sheet-marks'
import { CUSTOMER_CREDIT, FORM_SHEET } from '@/lib/credit-brand'
import {
  negativeStockWarning,
  officeStoreId,
  type StockByStore,
  type StockWarning,
  type StoreChoice,
} from '@/lib/store-stock'
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
  /** Package barcode — searchable on invoice/receipt lines the same way as at the till. */
  barcode?: string | null
  /** Piece / meter / kg — shown next to qty everywhere. */
  unitOfMeasure?: string | null
  /** GROUP members expanded onto the form when the group is chosen. */
  components?: {
    itemId: string
    label: string
    quantity: string
    price: string | null
    description: string | null
    taxCodeId: string | null
    type?: string
  }[]
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
  workScope?: string | null
  workSite?: string | null
  paymentTermId: string | null
  depositAccountId: string | null
  projectId?: string | null
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
 * where money goes; company form templates control which fields and columns show.
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
  initialProjectId,
  initialWorkSite,
  projects = [],
  neighbors,
  stores = [],
  stock = {},
  openSources = [],
  formCustomization,
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
  /** Set when the form was opened from a project job folder. */
  initialProjectId?: string
  /** Site on the linked project, used until the user types a work site. */
  initialWorkSite?: string
  /** Open jobs this sale can belong to. */
  projects?: { id: string; label: string; customerId: string; siteLocation?: string | null }[]
  /** The saved document before this one, and the one after, in date then number order. */
  neighbors?: {
    previous: { id: string; number: string } | null
    next: { id: string; number: string } | null
  }
  /** Stores a line can be issued from. The office is the default. */
  stores?: StoreChoice[]
  /** Quantity of each tracked item in each store. */
  stock?: StockByStore
  /** Open estimates, quotations, and sales orders a new invoice or receipt can use. */
  openSources?: OpenSourceOption[]
  /** Company form field/column templates for this document type. */
  formCustomization?: FormCustomizationProps
}) {
  const officeId = officeStoreId(stores)
  const defaultStoreId =
    initialStoreId && stores.some((store) => store.id === initialStoreId) ? initialStoreId : officeId
  const router = useRouter()
  const [state, formAction] = useActionState(saveDocumentForm, idleState)
  // Invoice, quotation, sales receipt, credit, and refund share the print sheet —
  // the same paper POS and the counter print. Layout skins stay available only
  // when the type is not locked to that sheet.
  const usesPrintSheet = (PRINT_SHEET_SALES_TYPES as readonly string[]).includes(config.type)
  const usesInvoiceSheet =
    config.type === 'INVOICE' || isProposal(config.type) || isSalesOrder(config.type)
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
  const layoutFromCompany = activeForm?.layoutId
  const template: FormTemplateId = (() => {
    if (usesPrintSheet) return 'sheet'
    if (layoutFromCompany) {
      const known = usesInvoiceSheet
        ? isInvoiceFormTemplateId(layoutFromCompany)
        : config.type === 'SALES_RECEIPT'
          ? isSalesReceiptFormTemplateId(layoutFromCompany)
          : isSalesFormTemplateId(layoutFromCompany)
      if (known) return layoutFromCompany as FormTemplateId
    }
    return usesInvoiceSheet
      ? DEFAULT_INVOICE_FORM_TEMPLATE
      : config.type === 'SALES_RECEIPT'
        ? DEFAULT_SALES_RECEIPT_FORM_TEMPLATE
        : DEFAULT_SALES_FORM_TEMPLATE
  })()
  const setTemplate = (next: FormTemplateId) => {
    if (!activeForm) return
    setDraftTemplate({ ...activeForm, layoutId: next })
  }
  const showField = (id: string) => isFieldVisible(activeForm?.fields, id)
  const showColumn = (id: string) => isColumnVisible(activeForm?.columns, id)
  const layoutOptions = usesPrintSheet
    ? undefined
    : usesInvoiceSheet
      ? INVOICE_FORM_TEMPLATES
      : config.type === 'SALES_RECEIPT'
        ? SALES_RECEIPT_FORM_TEMPLATES
        : SALES_FORM_TEMPLATES
  const savedDiscount = Number(document?.discountAmount ?? 0)
  const liftedPercent =
    config.type === 'SALES_RECEIPT' && savedDiscount <= 0 ? sharedLineDiscount(document) : ''
  const [discountKind, setDiscountKind] = useState<'amount' | 'percent'>(savedDiscount > 0 ? 'amount' : 'percent')
  const [discountValue, setDiscountValue] = useState(savedDiscount > 0 ? savedDiscount.toFixed(2) : liftedPercent)

  const [number, setNumber] = usePropState(documentNumber)
  const [customerId, setCustomerId] = useState(document?.customerId ?? initialCustomerId ?? '')
  const [projectId, setProjectId] = useState(document?.projectId ?? initialProjectId ?? '')
  const [date, setDate] = useState(document?.date ?? today)
  const [reference, setReference] = useState(document?.reference ?? '')
  const [memo, setMemo] = useState(document?.memo ?? '')
  const [customerMessage, setCustomerMessage] = useState(document?.customerMessage ?? '')
  const [workScope, setWorkScope] = useState(document?.workScope ?? '')
  const [workSite, setWorkSite] = useState(
    document?.workSite ??
      initialWorkSite ??
      projects.find((row) => row.id === (document?.projectId ?? initialProjectId))?.siteLocation ??
      '',
  )
  const [paymentTermId, setPaymentTermId] = useState(document?.paymentTermId ?? '')
  const [depositAccountId, setDepositAccountId] = useState(
    document?.depositAccountId ?? depositAccounts[0]?.id ?? '',
  )
  /** Estimate / quotation / order the lines were brought from — closed on save. */
  const [convertedFromId, setConvertedFromId] = useState<string | null>(null)
  const [convertedFromLabel, setConvertedFromLabel] = useState<string | null>(null)
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
  /** Set in the button click; read when the form builds the payload on submit. */
  const saveAsDraft = useRef(false)

  /** Wipe typed fields back to a blank sheet (or the last saved document when editing). */
  const resetForm = () => {
    if (document) {
      const restoredDiscount = Number(document.discountAmount ?? 0)
      const restoredPercent =
        config.type === 'SALES_RECEIPT' && restoredDiscount <= 0
          ? sharedLineDiscount(document)
          : ''
      setNumber(documentNumber)
      setCustomerId(document.customerId)
      setProjectId(document.projectId ?? '')
      setDate(document.date)
      setReference(document.reference ?? '')
      setMemo(document.memo ?? '')
      setCustomerMessage(document.customerMessage ?? '')
      setWorkScope(document.workScope ?? '')
      setWorkSite(document.workSite ?? '')
      setPaymentTermId(document.paymentTermId ?? '')
      setDepositAccountId(document.depositAccountId ?? depositAccounts[0]?.id ?? '')
      setDiscountKind(restoredDiscount > 0 ? 'amount' : 'percent')
      setDiscountValue(restoredDiscount > 0 ? restoredDiscount.toFixed(2) : restoredPercent)
      setConvertedFromId(null)
      setConvertedFromLabel(null)
      setLines(
        withMinimumLines(
          document.lines.map((line, index) => ({
            key: index + 1,
            itemId: line.itemId ?? '',
            description: line.description ?? '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: restoredPercent ? '' : (line.discountPercent ?? ''),
            taxCodeId: line.taxCodeId ?? '',
            storeId: line.storeId ?? defaultStoreId,
          })),
          minimumLines,
          defaultStoreId,
        ),
      )
      nextKey.current = Math.max(document.lines.length, minimumLines) + 1
      return
    }
    setCustomerId(initialCustomerId ?? '')
    setProjectId(initialProjectId ?? '')
    setDate(today)
    setReference('')
    setMemo('')
    setCustomerMessage('')
    setWorkScope('')
    setWorkSite(
      initialWorkSite ??
        projects.find((row) => row.id === initialProjectId)?.siteLocation ??
        '',
    )
    setPaymentTermId('')
    setDepositAccountId(depositAccounts[0]?.id ?? '')
    setDiscountKind('percent')
    setDiscountValue('')
    setConvertedFromId(null)
    setConvertedFromLabel(null)
    setLines(Array.from({ length: minimumLines }, (_, index) => empty(index + 1, defaultStoreId)))
    nextKey.current = minimumLines + 1
  }

  // Start on the customer name so Tab walks the form without the mouse.
  useEffect(() => {
    if (customerId) return
    const timer = window.setTimeout(() => window.document.getElementById('customerId')?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [customerId])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(
        saveAsDraft.current ? 'Saved as draft.' : (state.message ?? 'Saved.'),
      )
      if (afterSave.current === 'new' && !document?.id) {
        setCustomerId(initialCustomerId ?? '')
        setProjectId(initialProjectId ?? '')
        setDate(today)
        setReference('')
        setMemo('')
        setCustomerMessage('')
        setWorkScope('')
        setWorkSite(
          initialWorkSite ??
            projects.find((row) => row.id === initialProjectId)?.siteLocation ??
            '',
        )
        setPaymentTermId('')
        setDepositAccountId(depositAccounts[0]?.id ?? '')
        setDiscountKind('percent')
        setDiscountValue('')
        setConvertedFromId(null)
        setConvertedFromLabel(null)
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
  const discountItemIds = useMemo(
    () => new Set(items.filter((item) => item.type === 'DISCOUNT').map((item) => item.id)),
    [items],
  )
  const paymentItemIds = useMemo(
    () => new Set(items.filter((item) => item.type === 'PAYMENT').map((item) => item.id)),
    [items],
  )
  const subtotalItemIds = useMemo(
    () => new Set(items.filter((item) => item.type === 'SUBTOTAL').map((item) => item.id)),
    [items],
  )
  const trackedIds = useMemo(
    () => items.filter((item) => item.type === 'INVENTORY').map((item) => item.id),
    [items],
  )
  const itemOptions = useMemo(
    () =>
      items.map((item) => {
        const unit = resolveUnit(item.unitOfMeasure)
        return {
          id: item.id,
          label: item.label,
          group: item.group,
          unitOfMeasure: item.unitOfMeasure ?? null,
          hint:
            [
              item.barcode,
              item.sku,
              item.onHand != null ? `${item.onHand} ${unit} on hand` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
        }
      }),
    [items],
  )
  /**
   * Line key → amber note when this sale takes a store to or below zero. Uses the
   * per-store stock already loaded for the store picker; no extra queries. Only
   * invoices and sales receipts move stock. Earlier lines for the same item and
   * store count first, and on edit this document's own saved lines are added
   * back (they are already in the figures).
   */
  const stockWarnings = useMemo(() => {
    const out: Record<number, StockWarning> = {}
    if (config.type !== 'INVOICE' && config.type !== 'SALES_RECEIPT') return out
    const tracked = new Set(trackedIds)
    const keyFor = (itemId: string, storeId: string | null | undefined) =>
      `${itemId}|${stores.length > 0 ? storeId || officeId : ''}`
    const ownSaved = new Map<string, number>()
    if (document?.id) {
      for (const saved of document.lines) {
        if (!saved.itemId) continue
        const key = keyFor(saved.itemId, saved.storeId)
        ownSaved.set(key, (ownSaved.get(key) ?? 0) + (Number(saved.quantity) || 0))
      }
    }
    const taken = new Map<string, number>()
    for (const line of lines) {
      if (!line.itemId || !tracked.has(line.itemId)) continue
      const storeId = line.storeId || officeId
      const key = keyFor(line.itemId, storeId)
      const recorded =
        stores.length > 0
          ? Number(stock[line.itemId]?.[storeId] ?? '0')
          : Number(itemById.get(line.itemId)?.onHand ?? Number.NaN)
      const before = recorded + (ownSaved.get(key) ?? 0) - (taken.get(key) ?? 0)
      const qty = Number(line.quantity)
      const storeName = stores.find((store) => store.id === storeId)?.name ?? ''
      const warning = negativeStockWarning(before, qty, storeName)
      if (warning) out[line.key] = warning
      if (Number.isFinite(qty) && qty > 0) taken.set(key, (taken.get(key) ?? 0) + qty)
    }
    return out
  }, [config.type, trackedIds, stores, officeId, document, lines, stock, itemById])
  const taxById = useMemo(() => new Map(taxCodes.map((code) => [code.id, code])), [taxCodes])
  const showTax = taxCodes.length > 0

  const offersDocumentDiscount =
    config.type === 'INVOICE' || config.type === 'SALES_RECEIPT' || isSalesOrder(config.type)

  const totals = useMemo(() => {
    let netSubtotal = ZERO
    let tax = ZERO

    for (const line of lines) {
      const itemType = itemById.get(line.itemId)?.type
      // Subtotal is display-only — never part of the document math.
      if (itemType === 'SUBTOTAL') continue

      const quantity = parseMoneyInput(line.quantity) ?? ZERO
      const price = parseMoneyInput(line.unitPrice) ?? ZERO
      if (quantity.isZero() && price.isZero()) continue

      const reduces = itemType === 'DISCOUNT' || itemType === 'PAYMENT'
      const sign = reduces ? new Decimal(-1) : new Decimal(1)
      const gross = quantity.times(price).times(sign).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const discountPercent = reduces ? ZERO : (parseMoneyInput(line.discountPercent) ?? ZERO)
      const lineDiscount = gross.times(discountPercent).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const amount = gross.minus(lineDiscount)

      const code = itemType === 'PAYMENT' ? null : line.taxCodeId ? taxById.get(line.taxCodeId) : null
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
  }, [lines, taxById, itemById, offersDocumentDiscount, discountKind, discountValue])

  /** Running sum shown on a SUBTOTAL line (items since the previous subtotal). */
  const subtotalDisplayByKey = useMemo(() => {
    const out: Record<number, string> = {}
    let running = ZERO
    for (const line of lines) {
      const itemType = itemById.get(line.itemId)?.type
      if (itemType === 'SUBTOTAL') {
        out[line.key] = running.toFixed(2)
        running = ZERO
        continue
      }
      const quantity = parseMoneyInput(line.quantity) ?? ZERO
      const price = parseMoneyInput(line.unitPrice) ?? ZERO
      if (quantity.isZero() && price.isZero()) continue
      const reduces = itemType === 'DISCOUNT' || itemType === 'PAYMENT'
      const sign = reduces ? new Decimal(-1) : new Decimal(1)
      const gross = quantity.times(price).times(sign).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const discountPercent = reduces ? ZERO : (parseMoneyInput(line.discountPercent) ?? ZERO)
      const lineDiscount = gross.times(discountPercent).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      running = running.plus(gross.minus(lineDiscount))
    }
    return out
  }, [lines, itemById])

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  const chooseItem = (key: number, itemId: string) => {
    const item = itemId ? itemById.get(itemId) : null

    // GROUP expands into its members (QuickBooks Desktop).
    if (item?.type === 'GROUP') {
      if (!item.components || item.components.length === 0) {
        toast.error(
          `"${item.label}" has no items. Open the group and add members before using it on a sale.`,
        )
        return
      }
      setLines((current) => {
        const index = current.findIndex((line) => line.key === key)
        if (index < 0) return current
        const host = current[index]!
        const groupQty = parseMoneyInput(host.quantity)?.greaterThan(0)
          ? parseMoneyInput(host.quantity)!
          : new Decimal(1)
        const members: Line[] = item.components!.map((component) => {
          const memberQty = (parseMoneyInput(component.quantity) ?? new Decimal(1)).times(groupQty)
          return {
            key: nextKey.current++,
            itemId: component.itemId,
            description: component.description ?? component.label,
            quantity: memberQty.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''),
            unitPrice: component.price ?? '',
            discountPercent: '',
            taxCodeId: component.taxCodeId ?? '',
            storeId: host.storeId || defaultStoreId,
          }
        })
        return [...current.slice(0, index), ...members, ...current.slice(index + 1)]
      })
      return
    }

    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              itemId,
              description: item?.description ?? '',
              unitPrice: item?.type === 'SUBTOTAL' ? '' : (item?.price ?? ''),
              taxCodeId: item?.type === 'SUBTOTAL' || item?.type === 'PAYMENT' ? '' : (item?.taxCodeId ?? ''),
              quantity:
                item?.type === 'SUBTOTAL'
                  ? '1'
                  : line.quantity.trim() === ''
                    ? '1'
                    : line.quantity,
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

  // A rate alone is not a sale line — item or description must name what moved.
  const filled = lines.filter((line) => Boolean(line.itemId || line.description.trim()))

  const applyFromSource = (applied: AppliedSource) => {
    const seeded = applied.lines.map((line, index) => ({
      key: index + 1,
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxCodeId: line.taxCodeId,
      storeId: line.storeId || defaultStoreId,
    }))
    setLines(withMinimumLines(seeded, minimumLines, defaultStoreId))
    nextKey.current = Math.max(seeded.length, minimumLines) + 1
    setConvertedFromId(applied.sourceId)
    setConvertedFromLabel(`${byType(applied.sourceType).singular} ${applied.sourceNumber}`)
    if (applied.reference && !reference) setReference(applied.reference)
    if (applied.memo && !memo) setMemo(applied.memo)
    if (applied.customerMessage && !customerMessage) setCustomerMessage(applied.customerMessage)
    if (applied.workScope && !workScope) setWorkScope(applied.workScope)
    if (applied.workSite && !workSite) setWorkSite(applied.workSite)
    if (applied.paymentTermId) setPaymentTermId(applied.paymentTermId)
  }

  const changeCustomer = (id: string) => {
    setCustomerId(id)
    if (convertedFromId) {
      setConvertedFromId(null)
      setConvertedFromLabel(null)
    }
    if (projectId) {
      const job = projects.find((row) => row.id === projectId)
      if (job && job.customerId !== id) setProjectId('')
    }
  }

  const payloadInput = useRef<HTMLInputElement>(null)
  const payloadFor = (draft: boolean) =>
    JSON.stringify({
      ...(document?.id ? { id: document.id } : { type: config.type }),
      number,
      customerId,
      date,
      reference,
      memo,
      customerMessage,
      workScope,
      workSite,
      paymentTermId,
      depositAccountId: config.needsDeposit ? depositAccountId : '',
      projectId,
      saveAsDraft: draft,
      ...(convertedFromId && !document?.id ? { convertedFromId } : {}),
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

  // Payment items can bring amount due to zero (still a real sale — cash already taken).
  const hasPaymentLine = filled.some((line) => paymentItemIds.has(line.itemId))
  const canSave =
    customerId !== '' &&
    filled.length > 0 &&
    !totals.total.isNegative() &&
    (totals.total.greaterThan(0) || hasPaymentLine) &&
    (!config.needsDeposit || depositAccountId !== '')
  /** A draft can be unfinished — customer and at least one line are enough. */
  const canDraft = customerId !== '' && filled.length > 0

  const shared = {
    config,
    state,
    customers,
    itemOptions,
    discountItemIds,
    paymentItemIds,
    subtotalItemIds,
    subtotalDisplayByKey,
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
    setCustomerId: changeCustomer,
    projectId,
    setProjectId: (id: string) => {
      setProjectId(id)
      if (!id) return
      const site = projects.find((row) => row.id === id)?.siteLocation
      if (site) setWorkSite((current) => current.trim() ? current : site)
    },
    projects,
    date,
    setDate,
    reference,
    setReference,
    memo,
    setMemo,
    customerMessage,
    setCustomerMessage,
    workScope,
    setWorkScope,
    workSite,
    setWorkSite,
    paymentTermId,
    setPaymentTermId,
    depositAccountId,
    setDepositAccountId,
    lines,
    stores,
    stock,
    trackedIds,
    stockWarnings,
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
    openSources:
      (config.type === 'INVOICE' || config.type === 'SALES_RECEIPT') && !document?.id
        ? openSources
        : [],
    convertTarget:
      config.type === 'SALES_RECEIPT' ? ('SALES_RECEIPT' as const) : ('INVOICE' as const),
    convertedFromLabel,
    applyFromSource,
    showField,
    showColumn,
  }

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (payloadInput.current) payloadInput.current.value = payloadFor(saveAsDraft.current)
      }}
      className={
        config.type === 'SALES_RECEIPT' ? 'mx-auto w-full max-w-5xl space-y-2' : 'space-y-2'
      }
    >
      <input ref={payloadInput} type="hidden" name="payload" defaultValue={payloadFor(false)} />

      {config.type === 'SALES_RECEIPT' ? (
        <SalesReceiptToolbar
          slug={config.slug}
          recordId={document?.id}
          neighbors={neighbors}
          canSave={canSave}
          onSave={() => {
            afterSave.current = 'close'
            saveAsDraft.current = false
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-1 print:hidden">
          <RecordNav
            {...neighborHrefs(`/sales/${config.slug}`, neighbors, document?.id)}
          />
        </div>
      )}

      {formCustomization && activeForm ? (
        <FormCustomizePanel
          family={formCustomization.family}
          templates={formCustomization.templates}
          activeId={formCustomization.activeId}
          draft={activeForm}
          onDraftChange={setFormDraft}
          fieldCatalog={SALES_FORM_FIELDS}
          columnCatalog={SALES_FORM_COLUMNS}
          canManage={formCustomization.canManage}
          layoutOptions={layoutOptions}
        />
      ) : usesPrintSheet ? null : usesInvoiceSheet ? (
        <TemplateMenu options={INVOICE_FORM_TEMPLATES} value={template} onChange={setTemplate} />
      ) : config.type === 'SALES_RECEIPT' ? (
        <TemplateMenu options={SALES_RECEIPT_FORM_TEMPLATES} value={template} onChange={setTemplate} />
      ) : (
        <TemplatePicker value={template as SalesFormTemplateId} onChange={setTemplate} />
      )}
      {usesPrintSheet || template === 'sheet' ? <SheetLayout {...shared} /> : null}
      {!usesPrintSheet && template === 'invoice' ? <InvoiceLayout {...shared} /> : null}
      {!usesPrintSheet && template === 'classic' ? <ClassicLayout {...shared} /> : null}
      {!usesPrintSheet && template === 'service' ? <ServiceLayout {...shared} /> : null}
      {!usesPrintSheet && template === 'modern' ? <ModernLayout {...shared} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button type="button" variant="outline" onClick={() => router.push(`/sales/${config.slug}`)}>
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

function ProjectField({ props }: { props: LayoutProps }) {
  if (!props.showField('project')) return null
  if (props.projects.length === 0 && !props.projectId) return null
  const options = props.projects.filter(
    (row) => !props.customerId || row.customerId === props.customerId || row.id === props.projectId,
  )
  return (
    <Field name="projectId" label="Project" error={props.state.fieldErrors?.projectId}>
      <EntityPicker
        id="projectId"
        options={options}
        value={props.projectId || null}
        onChange={(next) => props.setProjectId(next ?? '')}
        placeholder="Link a job"
        clearable
        emptyMessage="No projects for this customer"
        error={props.state.fieldErrors?.projectId}
      />
    </Field>
  )
}

type LayoutProps = {
  config: SalesTypeConfig
  state: FormState
  customers: CustomerOption[]
  itemOptions: {
    id: string
    label: string
    group?: string
    hint?: string
    unitOfMeasure?: string | null
  }[]
  /** Item ids whose type is Discount — line amount reduces the document. */
  discountItemIds: Set<string>
  paymentItemIds: Set<string>
  subtotalItemIds: Set<string>
  /** SUBTOTAL line key → running sum to show in Amount. */
  subtotalDisplayByKey: Record<number, string>
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
  projectId: string
  setProjectId: (value: string) => void
  projects: { id: string; label: string; customerId: string; siteLocation?: string | null }[]
  date: string
  setDate: (value: string) => void
  reference: string
  setReference: (value: string) => void
  memo: string
  setMemo: (value: string) => void
  customerMessage: string
  setCustomerMessage: (value: string) => void
  workScope: string
  setWorkScope: (value: string) => void
  workSite: string
  setWorkSite: (value: string) => void
  paymentTermId: string
  setPaymentTermId: (value: string) => void
  depositAccountId: string
  setDepositAccountId: (value: string) => void
  lines: Line[]
  stores: StoreChoice[]
  stock: StockByStore
  trackedIds: string[]
  /** Line key → negative-stock note (information only, never blocks). */
  stockWarnings: Record<number, StockWarning>
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
  openSources: OpenSourceOption[]
  convertTarget: 'INVOICE' | 'SALES_RECEIPT'
  convertedFromLabel: string | null
  applyFromSource: (applied: AppliedSource) => void
  showField: (id: string) => boolean
  showColumn: (id: string) => boolean
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
  const customer = customers.find((row) => row.id === props.customerId)
  const termId = props.paymentTermId || customer?.paymentTermId || ''
  const term = terms.find((row) => row.id === termId)
  const due =
    isCalendarDate(props.date)
      ? dueDateFor(props.date, term ? { type: term.type, dueDays: term.dueDays } : null)
      : props.date
  const showDue =
    config.type === 'INVOICE' ||
    config.type === 'CREDIT_MEMO' ||
    isProposal(config.type) ||
    isSalesOrder(config.type)
  const dueLabel = isProposal(config.type) || isSalesOrder(config.type) ? 'Valid until' : 'Due date'

  return (
    <div className="space-y-2.5">
      {/* Odoo-style: Customer name first, then date / number / due / PO */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <Field name="customerId" label="Customer name" required error={state.fieldErrors?.customerId}>
          <EntityPicker
            id="customerId"
            kind="customer"
            options={customers}
            value={props.customerId || null}
            onChange={(next) => {
              const id = next ?? ''
              props.setCustomerId(id)
              const chosen = customers.find((row) => row.id === id)
              if (chosen?.paymentTermId) props.setPaymentTermId(chosen.paymentTermId)
            }}
            placeholder="Search or add a customer"
            required
            error={state.fieldErrors?.customerId}
          />
        </Field>

        <ProjectField props={props} />

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

        <LockedNumber
          label={`${config.singular} no.`}
          value={props.number}
          onChange={props.setNumber}
          error={state.fieldErrors?.number}
          recordId={props.recordId}
        />

        {showDue ? (
          <Field name="dueDate" label={dueLabel}>
            <Input id="dueDate" value={isCalendarDate(due) ? formatDate(due) : ''} readOnly />
          </Field>
        ) : null}

        {props.showField('reference') ? (
          <Field name="reference" label="PO" error={state.fieldErrors?.reference}>
            <Input
              {...fieldProps('reference', state.fieldErrors?.reference)}
              value={props.reference}
              onChange={(event) => props.setReference(event.target.value)}
              placeholder="PO number"
            />
          </Field>
        ) : null}
      </div>

      {(config.type === 'INVOICE' || config.needsDeposit) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {config.type === 'INVOICE' && props.showField('paymentTerms') ? (
            <Field
              name="paymentTermId"
              label="Terms"
              error={state.fieldErrors?.paymentTermId}
            >
              <NativeSelect
                {...fieldProps('paymentTermId', state.fieldErrors?.paymentTermId, true)}
                value={props.paymentTermId}
                onChange={(event) => props.setPaymentTermId(event.target.value)}
              >
                <option value="">Customer&rsquo;s default</option>
                {terms.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
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
      )}
    </div>
  )
}

function DiscountControl({ props }: { props: LayoutProps }) {
  if (props.config.type !== 'INVOICE' && props.config.type !== 'SALES_RECEIPT') return null
  if (!props.showField('documentDiscount')) return null
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
  const showWorkScope = isProposal(props.config.type)
  const customerName =
    props.customers.find((row) => row.id === props.customerId)?.label ?? ''
  const showSite = showWorkScope && props.showField('workSite')
  const showScope = showWorkScope && props.showField('workScope')
  return (
    <div className="grid gap-2">
      {showSite || showScope ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {showSite ? (
            <Field
              name="workSite"
              label="Work site"
              hint="Magaca ama nooca goobta shaqada. Waxaa ka soo muuqda hoosta Sales person."
              error={props.state.fieldErrors?.workSite}
            >
              <Input
                {...fieldProps('workSite', props.state.fieldErrors?.workSite)}
                value={props.workSite}
                onChange={(event) => props.setWorkSite(event.target.value)}
                placeholder="e.g. Alanley villa, Site A, Warehouse 2"
              />
            </Field>
          ) : null}
          {showScope ? (
            <Field
              name="workScope"
              label="Work / job section"
              hint="Nooca shaqada ama qaybta mashruuca. Waxaa lagu daabacaa quotation-ka magaca macmiilka."
              error={props.state.fieldErrors?.workScope}
            >
              <Input
                {...fieldProps('workScope', props.state.fieldErrors?.workScope)}
                value={props.workScope}
                onChange={(event) => props.setWorkScope(event.target.value)}
                placeholder={
                  customerName
                    ? `e.g. Foundation works — ${customerName}`
                    : 'e.g. Foundation works, Electrical, Phase 2'
                }
              />
            </Field>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field name="customerMessage" label="Message" error={props.state.fieldErrors?.customerMessage}>
          <Input
            {...fieldProps('customerMessage', props.state.fieldErrors?.customerMessage)}
            value={props.customerMessage}
            onChange={(event) => props.setCustomerMessage(event.target.value)}
            placeholder="Thank you for your business"
          />
        </Field>
        <Field name="memo" label="Memo" error={props.state.fieldErrors?.memo}>
          <Input
            {...fieldProps('memo', props.state.fieldErrors?.memo)}
            value={props.memo}
            onChange={(event) => props.setMemo(event.target.value)}
            placeholder="Internal note"
          />
        </Field>
      </div>
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
      <CardContent className="space-y-3 p-3 sm:p-4">
        <FormStatus state={state} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <PartyInfo>
            <div className="grid gap-2 sm:grid-cols-2">
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
              <ProjectField props={props} />
            </div>
            {props.showField('addresses') &&
            (customer?.billingAddress || customer?.shippingAddress) ? (
              <div className="grid gap-2 md:grid-cols-2">
                <AddressBox label="Billing address" value={customer?.billingAddress ?? ''} empty="No billing address" />
                <AddressBox label="Shipping address" value={customer?.shippingAddress ?? ''} empty="No shipping address" />
              </div>
            ) : null}
          </PartyInfo>
          <div className="text-right">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {customerPaperTotalLabel(props.config.type, props.config.needsDeposit)}
            </p>
            <p className="text-xl font-semibold tabular text-primary">{formatMoney(props.totals.total, props.currency)}</p>
          </div>
        </div>

        {(props.config.type === 'INVOICE' || props.config.type === 'SALES_RECEIPT') &&
        !props.recordId ? (
          <FromSourcePicker
            customerId={props.customerId}
            sources={props.openSources}
            today={today}
            currency={props.currency}
            target={props.convertTarget}
            onApply={props.applyFromSource}
          />
        ) : null}
        {props.convertedFromLabel && !props.recordId ? (
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            Lines from{' '}
            <span className="font-medium text-foreground">{props.convertedFromLabel}</span>. That
            document closes when you save this one.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <LockedNumber
            label={`${props.config.singular} no.`}
            value={props.number}
            onChange={props.setNumber}
            error={state.fieldErrors?.number}
            recordId={props.recordId}
          />
          {props.config.needsDeposit ? null : (
            <Field
              name="dueDate"
              label={
                isProposal(props.config.type) || isSalesOrder(props.config.type)
                  ? 'Valid until'
                  : 'Due date'
              }
            >
              <Input id="dueDate" value={isCalendarDate(due) ? formatDate(due) : ''} readOnly />
            </Field>
          )}
          {props.showField('reference') ? (
            <Field name="reference" label="PO" error={state.fieldErrors?.reference}>
              <Input
                {...fieldProps('reference', state.fieldErrors?.reference)}
                value={props.reference}
                onChange={(event) => props.setReference(event.target.value)}
                placeholder="PO number"
              />
            </Field>
          ) : null}
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
          ) : props.showField('paymentTerms') ? (
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
          ) : null}
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
              <dt>{customerPaperTotalLabel(props.config.type, props.config.needsDeposit)}</dt>
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
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <div className="max-h-16 overflow-hidden whitespace-pre-line rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground">
        {value || <span className="text-muted-foreground">{empty}</span>}
      </div>
    </div>
  )
}

const noteBox =
  'flex min-h-20 w-full rounded-md border border-input bg-card px-2.5 py-2 text-[0.8125rem] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25'

function InvoiceLines({ props }: { props: LayoutProps }) {
  const showDescription = props.showColumn('description')
  const showQty = props.showColumn('qty')
  const showRate = props.showColumn('rate')
  const showStore = props.showColumn('store') && props.stores.length > 0
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="ledger-head text-[12px] font-semibold uppercase tracking-wide">
              <th className="w-44 px-2 py-2 text-left">Item</th>
              {showDescription ? <th className="px-2 py-2 text-left">Description</th> : null}
              {showQty ? <th className="w-24 px-2 py-2 text-center">Qty</th> : null}
              {showRate ? <th className="w-28 px-2 py-2 text-right">Rate</th> : null}
              <th className="w-28 px-2 py-2 text-right">Amount</th>
              {showStore ? <th className="w-40 px-2 py-2 text-left">Store</th> : null}
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
                  {!showStore ? <StockWarningNote warning={props.stockWarnings[line.key]} /> : null}
                </td>
                {showDescription ? (
                  <td className="px-1 py-1">
                    <Input
                      aria-label={`Description, line ${index + 1}`}
                      className={lineInput}
                      value={line.description}
                      onChange={(event) => props.update(line.key, { description: event.target.value })}
                    />
                  </td>
                ) : null}
                {showQty ? (
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <Input
                        aria-label={`Quantity, line ${index + 1}`}
                        inputMode="decimal"
                        readOnly={props.subtotalItemIds.has(line.itemId)}
                        className={cn(lineInput, 'min-w-0 flex-1 tabular text-center')}
                        value={props.subtotalItemIds.has(line.itemId) ? '' : line.quantity}
                        onChange={(event) => props.update(line.key, { quantity: event.target.value })}
                      />
                      {line.itemId && !props.subtotalItemIds.has(line.itemId) ? (
                        <span
                          className="w-9 shrink-0 truncate text-center text-[0.65rem] font-medium uppercase text-muted-foreground"
                          title={resolveUnit(
                            props.itemOptions.find((item) => item.id === line.itemId)?.unitOfMeasure,
                          )}
                        >
                          {resolveUnit(
                            props.itemOptions.find((item) => item.id === line.itemId)?.unitOfMeasure,
                          )}
                        </span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
                {showRate ? (
                  <td className="px-1 py-1">
                    <Input
                      aria-label={`Rate, line ${index + 1}`}
                      inputMode="decimal"
                      readOnly={props.subtotalItemIds.has(line.itemId)}
                      className={cn(lineInput, 'tabular text-right')}
                      value={props.subtotalItemIds.has(line.itemId) ? '' : line.unitPrice}
                      onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
                    />
                  </td>
                ) : null}
                <td className="px-1 py-1">
                  <AmountField
                    line={line}
                    isDiscount={props.discountItemIds.has(line.itemId)}
                    isPayment={props.paymentItemIds.has(line.itemId)}
                    isSubtotal={props.subtotalItemIds.has(line.itemId)}
                    subtotalDisplay={props.subtotalDisplayByKey[line.key]}
                    onCommit={(next) => props.update(line.key, next)}
                  />
                </td>
                {showStore ? (
                  <td className="px-1 py-1 align-top">
                    <LineStore
                      stores={props.stores}
                      stock={props.stock}
                      tracked={props.trackedIds.includes(line.itemId)}
                      warn={props.config.type === 'INVOICE' || props.config.type === 'SALES_RECEIPT'}
                      warning={props.stockWarnings[line.key]}
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
                    tabIndex={-1}
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
  const credit = props.config.type === 'CREDIT_MEMO'
  const accent = credit ? CUSTOMER_CREDIT.accent : FORM_SHEET.accent
  const band = credit ? CUSTOMER_CREDIT.band : FORM_SHEET.band
  const marks = credit
    ? {
        markA: CUSTOMER_CREDIT.markA,
        markB: CUSTOMER_CREDIT.markB,
        markC: CUSTOMER_CREDIT.markC,
        markD: CUSTOMER_CREDIT.markD,
      }
    : {
        markA: FORM_SHEET.markA,
        markB: FORM_SHEET.markB,
        markC: FORM_SHEET.markC,
        markD: FORM_SHEET.markD,
      }

  return (
    <Card className="relative overflow-hidden border-border bg-card p-0 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-white sm:px-5"
        style={{ background: band }}
      >
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/80">
            {credit ? 'Customer credit' : props.organizationName}
          </p>
          <p className="text-base font-semibold tracking-wide sm:text-lg">{props.config.singular}</p>
        </div>
        {!credit ? (
          <p className="hidden text-right text-xs font-medium text-white/90 sm:block">
            {props.organizationName}
          </p>
        ) : null}
      </div>
      <SheetMarks colors={marks} />
      <CardContent className="relative space-y-2.5 bg-muted/25 px-3 py-3 sm:px-4">
        <FormStatus state={props.state} />

        <div
          className="rounded-md border border-border bg-card px-3 py-2.5 shadow-sm"
          style={{ borderTopColor: accent, borderTopWidth: 2 }}
        >
          <div
            className={cn(
              '[&_label]:text-[10px] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-[0.08em] [&_label]:text-primary',
            )}
          >
            <HeaderFields props={props} />
          </div>
        </div>

        {(props.config.type === 'INVOICE' || props.config.type === 'SALES_RECEIPT') &&
        !props.recordId ? (
          <FromSourcePicker
            customerId={props.customerId}
            sources={props.openSources}
            today={props.today}
            currency={props.currency}
            target={props.convertTarget}
            onApply={props.applyFromSource}
          />
        ) : null}
        {props.convertedFromLabel && !props.recordId ? (
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            Lines from{' '}
            <span className="font-medium text-foreground">{props.convertedFromLabel}</span>. That
            document closes when you save this one.
          </p>
        ) : null}

        <StripedLines props={props} />

        <div className="rounded-md border border-border bg-card px-3 py-2.5 shadow-sm">
          <NotesFields props={props} />
        </div>
      </CardContent>
    </Card>
  )
}


function SalesReceiptToolbar({
  slug,
  recordId,
  neighbors,
  canSave,
  onSave,
}: {
  slug: string
  recordId?: string
  neighbors?: {
    previous: { id: string; number: string } | null
    next: { id: string; number: string } | null
  }
  canSave: boolean
  onSave: () => void
}) {
  const router = useRouter()
  const nav = neighborHrefs(`/sales/${slug}`, neighbors, recordId)

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-background p-1.5 print:hidden">
      <RecordNav {...nav} />
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
            <DateField id="findDate" value={date} onChange={setDate} />
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
                className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
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
  className,
  isDiscount = false,
  isPayment = false,
  isSubtotal = false,
  subtotalDisplay,
}: {
  line: Line
  onCommit: (next: { quantity: string; unitPrice: string }) => void
  className?: string
  isDiscount?: boolean
  isPayment?: boolean
  isSubtotal?: boolean
  /** Pre-computed running sum for a SUBTOTAL line. */
  subtotalDisplay?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const reduces = isDiscount || isPayment
  const quantity = parseMoneyInput(line.quantity) ?? ZERO
  const price = parseMoneyInput(line.unitPrice) ?? ZERO
  const sign = reduces ? new Decimal(-1) : new Decimal(1)
  const gross = quantity.times(price).times(sign)
  const discount = reduces
    ? ZERO
    : gross.times(parseMoneyInput(line.discountPercent) ?? ZERO).dividedBy(100)
  const amount = quantity.isZero() && price.isZero() ? null : gross.minus(discount)
  const shown = isSubtotal
    ? (subtotalDisplay ?? '0')
    : draft ??
      (amount
        ? amount.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
        : '')

  return (
    <Input
      aria-label="Amount"
      inputMode="decimal"
      readOnly={isSubtotal}
      className={cn(className ?? lineInput, 'tabular text-right', isSubtotal && 'text-muted-foreground')}
      value={shown}
      onChange={(event) => {
        if (isSubtotal) return
        setDraft(event.target.value)
      }}
      onBlur={(event) => {
        if (isSubtotal) return
        // Discount / payment lines store a positive rate; the signed amount is display-only.
        const raw = event.currentTarget.value.trim()
        const entered = parseMoneyInput(raw)
        const totalText =
          reduces && entered ? entered.abs().toString() : event.currentTarget.value
        const next = unitPriceFromTotal(line.quantity, totalText, reduces ? '' : line.discountPercent)
        if (next) onCommit(next)
        setDraft(null)
      }}
    />
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
  'h-7 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-ring focus-visible:bg-muted/40'

/** Sheet line cells — quiet fields that follow the theme (no paper-white rims). */
const sheetLineInput =
  'h-7 rounded-md border border-border/70 bg-transparent px-2 text-foreground shadow-none focus-visible:border-ring focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring/20'

/** The line band from a ruled sales sheet: product brand head, then pale stripes. */
function StripedLines({ props }: { props: LayoutProps }) {
  const head =
    props.config.type === 'CREDIT_MEMO' ? CUSTOMER_CREDIT.band : FORM_SHEET.band
  const showDescription = props.showColumn('description')
  const showQty = props.showColumn('qty')
  const showRate = props.showColumn('rate')
  const showStore = props.showColumn('store') && props.stores.length > 0
  const showTax = props.showColumn('tax') && props.showTax

  return (
    <div className="rounded-lg bg-muted/40 p-1.5 sm:p-2">
      <div className="overflow-x-auto rounded-md">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-white" style={{ background: head }}>
              <th className="w-40 rounded-tl-md px-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                Item
              </th>
              {showDescription ? (
                <th className="px-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Description
                </th>
              ) : null}
              {showQty ? (
                <th className="w-24 px-1.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Qty
                </th>
              ) : null}
              {showRate ? (
                <th className="w-24 px-1.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                  Rate
                </th>
              ) : null}
              <th className="w-24 px-1.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                Amount
              </th>
              {showStore ? (
                <th className="w-36 px-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Store
                </th>
              ) : null}
              <th className="w-8 rounded-tr-md" />
            </tr>
          </thead>
          <tbody>
            {props.lines.map((line, index) => (
              <tr
                key={line.key}
                className={index % 2 === 0 ? 'bg-card/80' : 'bg-muted/30'}
              >
                <td className="px-1 py-1">
                  <EntityPicker
                    kind="item"
                    options={props.itemOptions}
                    value={line.itemId || null}
                    onChange={(next) => props.chooseItem(line.key, next ?? '')}
                    placeholder="Item"
                    clearable
                    className={sheetLineInput}
                  />
                  {!showStore ? <StockWarningNote warning={props.stockWarnings[line.key]} /> : null}
                </td>
                {showDescription ? (
                  <td className="px-1 py-1">
                    <Input
                      aria-label={`Description, line ${index + 1}`}
                      className={sheetLineInput}
                      value={line.description}
                      onChange={(event) => props.update(line.key, { description: event.target.value })}
                    />
                    {showTax && (line.itemId || line.description || line.unitPrice || line.taxCodeId) ? (
                      <NativeSelect
                        aria-label={`Tax, line ${index + 1}`}
                        value={line.taxCodeId}
                        onChange={(event) => props.update(line.key, { taxCodeId: event.target.value })}
                        className="mt-0.5 h-6 rounded-md border border-border/70 bg-transparent px-2 text-xs"
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
                ) : null}
                {showQty ? (
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <Input
                        aria-label={`Quantity, line ${index + 1}`}
                        inputMode="decimal"
                        readOnly={props.subtotalItemIds.has(line.itemId)}
                        className={cn(sheetLineInput, 'min-w-0 flex-1 tabular text-center')}
                        value={props.subtotalItemIds.has(line.itemId) ? '' : line.quantity}
                        onChange={(event) => props.update(line.key, { quantity: event.target.value })}
                      />
                      {line.itemId && !props.subtotalItemIds.has(line.itemId) ? (
                        <span
                          className="w-9 shrink-0 truncate text-center text-[0.65rem] font-medium uppercase text-muted-foreground"
                          title={resolveUnit(
                            props.itemOptions.find((item) => item.id === line.itemId)?.unitOfMeasure,
                          )}
                        >
                          {resolveUnit(
                            props.itemOptions.find((item) => item.id === line.itemId)?.unitOfMeasure,
                          )}
                        </span>
                      ) : null}
                    </div>
                  </td>
                ) : null}
                {showRate ? (
                  <td className="px-1 py-1">
                    <Input
                      aria-label={`Rate, line ${index + 1}`}
                      inputMode="decimal"
                      readOnly={props.subtotalItemIds.has(line.itemId)}
                      className={cn(sheetLineInput, 'tabular text-right')}
                      value={props.subtotalItemIds.has(line.itemId) ? '' : line.unitPrice}
                      onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
                    />
                  </td>
                ) : null}
                <td className="px-1 py-1">
                  <AmountField
                    line={line}
                    isDiscount={props.discountItemIds.has(line.itemId)}
                    isPayment={props.paymentItemIds.has(line.itemId)}
                    isSubtotal={props.subtotalItemIds.has(line.itemId)}
                    subtotalDisplay={props.subtotalDisplayByKey[line.key]}
                    onCommit={(next) => props.update(line.key, next)}
                    className={sheetLineInput}
                  />
                </td>
                {showStore ? (
                  <td className="px-1 py-1 align-top">
                    <LineStore
                      stores={props.stores}
                      stock={props.stock}
                      tracked={props.trackedIds.includes(line.itemId)}
                      warn={props.config.type === 'INVOICE' || props.config.type === 'SALES_RECEIPT'}
                      warning={props.stockWarnings[line.key]}
                      itemId={line.itemId}
                      storeId={line.storeId}
                      quantity={line.quantity}
                      onChange={(storeId) => props.update(line.key, { storeId })}
                      label={`Store, line ${index + 1}`}
                      className="[&_select]:h-7 [&_select]:rounded-md [&_select]:border [&_select]:border-border/70 [&_select]:bg-transparent [&_select]:px-2 [&_select]:text-sm"
                    />
                  </td>
                ) : null}
                <td className="px-0.5 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-md"
                    tabIndex={-1}
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

      <div className="mt-1 flex flex-wrap items-start justify-between gap-3 px-1 py-1.5">
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={props.addLine}>
          <PlusIcon /> Add line
        </Button>
        <TotalsBlock props={props} />
      </div>
    </div>
  )
}
