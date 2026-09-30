'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, LayoutTemplateIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState, type FormState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { EntityPicker } from '@/components/forms/entity-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { AccountPickerOption } from '@/lib/account-options'
import {
  DEFAULT_SALES_FORM_TEMPLATE,
  isSalesFormTemplateId,
  SALES_FORM_TEMPLATE_STORAGE_KEY,
  SALES_FORM_TEMPLATES,
  type SalesFormTemplateId,
} from '@/lib/sales-form-templates'
import { Decimal, formatMoney, parseMoneyInput, ZERO } from '@/lib/money'
import type { SalesTypeConfig } from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import { saveDocumentForm } from '@/app/(app)/sales/actions'

export type ItemOption = {
  id: string
  label: string
  price: string | null
  description: string | null
  taxCodeId: string | null
  type?: string
  group?: string
  onHand?: string | null
}
export type Option = { id: string; label: string }
export type TaxOption = Option & { rate: number; isInclusive: boolean }

type Line = {
  key: number
  itemId: string
  description: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxCodeId: string
}

const empty = (key: number): Line => ({
  key,
  itemId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  discountPercent: '',
  taxCodeId: '',
})

type DocumentSeed = {
  id: string
  customerId: string
  date: string
  reference: string | null
  memo: string | null
  customerMessage: string | null
  paymentTermId: string | null
  depositAccountId: string | null
  lines: {
    itemId: string | null
    description: string | null
    quantity: string
    unitPrice: string
    discountPercent: string | null
    taxCodeId: string | null
  }[]
}

/**
 * One form for every customer-facing document. The type decides the wording and
 * where money goes; the template only rearranges the sheet — Classic, Service or
 * Modern — the way a service business picks an invoice look.
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
}: {
  config: SalesTypeConfig
  customers: Option[]
  items: ItemOption[]
  taxCodes: TaxOption[]
  depositAccounts: AccountPickerOption[]
  terms: Option[]
  today: string
  currency: string
  organizationName: string
  document?: DocumentSeed
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveDocumentForm, idleState)
  const [template, setTemplate] = useState<SalesFormTemplateId>(DEFAULT_SALES_FORM_TEMPLATE)

  const [customerId, setCustomerId] = useState(document?.customerId ?? '')
  const [date, setDate] = useState(document?.date ?? today)
  const [reference, setReference] = useState(document?.reference ?? '')
  const [memo, setMemo] = useState(document?.memo ?? '')
  const [customerMessage, setCustomerMessage] = useState(document?.customerMessage ?? '')
  const [paymentTermId, setPaymentTermId] = useState(document?.paymentTermId ?? '')
  const [depositAccountId, setDepositAccountId] = useState(
    document?.depositAccountId ?? depositAccounts[0]?.id ?? '',
  )
  const [lines, setLines] = useState<Line[]>(
    document?.lines.length
      ? document.lines.map((line, index) => ({
          key: index + 1,
          itemId: line.itemId ?? '',
          description: line.description ?? '',
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent ?? '',
          taxCodeId: line.taxCodeId ?? '',
        }))
      : [empty(1), empty(2)],
  )
  const nextKey = useRef((document?.lines.length ?? 2) + 1)
  const handled = useRef(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SALES_FORM_TEMPLATE_STORAGE_KEY)
      if (stored && isSalesFormTemplateId(stored)) setTemplate(stored)
    } catch {
      // Private mode — keep the default.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SALES_FORM_TEMPLATE_STORAGE_KEY, template)
    } catch {
      // Ignore quota / private mode.
    }
  }, [template])

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      router.push(`/sales/${config.slug}`)
      router.refresh()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, config.slug])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
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
  const showTax = taxCodes.length > 0

  const totals = useMemo(() => {
    let subtotal = ZERO
    let tax = ZERO

    for (const line of lines) {
      const quantity = parseMoneyInput(line.quantity) ?? ZERO
      const price = parseMoneyInput(line.unitPrice) ?? ZERO
      if (quantity.isZero() && price.isZero()) continue

      const gross = quantity.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const discountPercent = parseMoneyInput(line.discountPercent) ?? ZERO
      const discount = gross.times(discountPercent).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const amount = gross.minus(discount)

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

  const chooseItem = (key: number, itemId: string) => {
    const item = itemId ? itemById.get(itemId) : null
    update(key, {
      itemId,
      description: item?.description ?? '',
      unitPrice: item?.price ?? '',
      taxCodeId: item?.taxCodeId ?? '',
    })
  }

  const addLine = () => setLines((current) => [...current, empty(nextKey.current++)])
  const removeLine = (key: number) =>
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)))

  const filled = lines.filter(
    (line) => line.itemId || line.description || parseMoneyInput(line.unitPrice)?.greaterThan(0),
  )

  const payloadFor = (saveAsDraft: boolean) =>
    JSON.stringify({
      ...(document?.id ? { id: document.id } : { type: config.type }),
      customerId,
      date,
      reference,
      memo,
      customerMessage,
      paymentTermId,
      depositAccountId: config.needsDeposit ? depositAccountId : '',
      saveAsDraft,
      lines: filled.map((line) => ({
        itemId: line.itemId,
        description: line.description,
        quantity: line.quantity || '1',
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        taxCodeId: line.taxCodeId,
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
    update,
    chooseItem,
    addLine,
    removeLine,
    totals,
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payloadFor(saveAsDraft)} />

      <TemplatePicker value={template} onChange={setTemplate} />

      {template === 'classic' ? <ClassicLayout {...shared} /> : null}
      {template === 'service' ? <ServiceLayout {...shared} /> : null}
      {template === 'modern' ? <ModernLayout {...shared} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/sales')}>
          Cancel
        </Button>
        {config.posts ? (
          <SubmitButton variant="outline" disabled={!canSave} onClick={() => setSaveAsDraft(true)}>
            Save as draft
          </SubmitButton>
        ) : null}
        <SubmitButton disabled={!canSave} onClick={() => setSaveAsDraft(false)} pendingLabel="Saving…">
          {config.posts ? 'Save and post' : `Save ${config.singular.toLowerCase()}`}
        </SubmitButton>
      </div>

      <p className="text-right text-xs text-muted-foreground">{config.effect}</p>
    </form>
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
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <LayoutTemplateIcon className="size-4 text-[#0B4F6C]" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-800">Form template</p>
          <p className="text-xs text-slate-500">Change the layout — the numbers and posting stay the same.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
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
                  ? 'border-[#0B4F6C] bg-sky-50 ring-2 ring-[#0B4F6C]/20'
                  : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{option.label}</span>
                {active ? <CheckIcon className="size-4 text-[#0B4F6C]" aria-hidden /> : null}
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
        active ? 'border-[#0B4F6C]/25 bg-white' : 'border-slate-200 bg-white',
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
          <span className="h-4 bg-[#0B4F6C]" />
          <span className="flex flex-1 flex-col gap-1 p-2">
            <span className="h-1.5 w-2/3 rounded bg-slate-200" />
            <span className="h-1.5 w-full rounded bg-slate-100" />
            <span className="h-1.5 w-full rounded bg-slate-100" />
          </span>
        </span>
      ) : null}
    </span>
  )
}

type LayoutProps = {
  config: SalesTypeConfig
  state: FormState
  customers: Option[]
  itemOptions: { id: string; label: string; group?: string; hint?: string }[]
  taxCodes: TaxOption[]
  depositAccounts: AccountPickerOption[]
  terms: Option[]
  today: string
  currency: string
  organizationName: string
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
  update: (key: number, patch: Partial<Line>) => void
  chooseItem: (key: number, itemId: string) => void
  addLine: () => void
  removeLine: (key: number) => void
  totals: { subtotal: Decimal; tax: Decimal; total: Decimal }
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

      <Field name="reference" label="Their reference" error={state.fieldErrors?.reference}>
        <Input
          {...fieldProps('reference', state.fieldErrors?.reference)}
          value={props.reference}
          onChange={(event) => props.setReference(event.target.value)}
          placeholder="PO number / job ref"
        />
      </Field>
    </div>
  )
}

function LineAmount({ line, currency }: { line: Line; currency: string }) {
  const quantity = parseMoneyInput(line.quantity) ?? ZERO
  const price = parseMoneyInput(line.unitPrice) ?? ZERO
  const gross = quantity.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const discount = gross
    .times(parseMoneyInput(line.discountPercent) ?? ZERO)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return <>{formatMoney(gross.minus(discount), currency)}</>
}

function TotalsBlock({ props }: { props: LayoutProps }) {
  return (
    <dl className="min-w-52 space-y-1 text-sm">
      <div className="flex justify-between gap-8">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular">{formatMoney(props.totals.subtotal, props.currency)}</dd>
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
      <Field name="memo" label="Internal note" hint="Not shown to the customer." error={props.state.fieldErrors?.memo}>
        <Input
          {...fieldProps('memo', props.state.fieldErrors?.memo, true)}
          value={props.memo}
          onChange={(event) => props.setMemo(event.target.value)}
        />
      </Field>
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
        <ClassicLinesTable props={props} quantityLabel="Qty" />
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

        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Work performed</h3>
              <p className="text-xs text-slate-500">Describe the service; quantity is hours or units.</p>
            </div>
          </div>
          <div className="space-y-3">
            {props.lines.map((line, index) => (
              <ServiceLineCard
                key={line.key}
                props={props}
                line={line}
                index={index}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <Button type="button" variant="outline" size="sm" onClick={props.addLine}>
              <PlusIcon /> Add service line
            </Button>
            <TotalsBlock props={props} />
          </div>
        </div>

        <NotesFields props={props} />
      </CardContent>
    </Card>
  )
}

function ServiceLineCard({
  props,
  line,
  index,
}: {
  props: LayoutProps
  line: Line
  index: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Line {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove line"
          disabled={props.lines.length <= 1}
          onClick={() => props.removeLine(line.key)}
        >
          <Trash2Icon />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">Service</label>
          <EntityPicker
            kind="item"
            options={props.itemOptions}
            value={line.itemId || null}
            onChange={(next) => props.chooseItem(line.key, next ?? '')}
            placeholder="Service or product"
            clearable
          />
        </div>
        <div className="lg:col-span-8">
          <label className="mb-1 block text-xs font-medium text-slate-600">Description of work</label>
          <Input
            aria-label="Description"
            value={line.description}
            onChange={(event) => props.update(line.key, { description: event.target.value })}
            placeholder="What was done for the customer"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Hours / qty</label>
          <Input
            aria-label="Hours or quantity"
            inputMode="decimal"
            className="tabular text-right"
            value={line.quantity}
            onChange={(event) => props.update(line.key, { quantity: event.target.value })}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Rate</label>
          <Input
            aria-label="Unit price"
            inputMode="decimal"
            className="tabular text-right"
            value={line.unitPrice}
            onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Disc %</label>
          <Input
            aria-label="Discount percent"
            inputMode="decimal"
            className="tabular text-right"
            value={line.discountPercent}
            onChange={(event) => props.update(line.key, { discountPercent: event.target.value })}
          />
        </div>
        {props.showTax ? (
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Tax</label>
            <NativeSelect
              aria-label="Tax code"
              value={line.taxCodeId}
              onChange={(event) => props.update(line.key, { taxCodeId: event.target.value })}
            >
              <option value="">No tax</option>
              {props.taxCodes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <div className="lg:col-span-3" />
        )}
        <div className="flex items-end justify-end lg:col-span-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Amount</p>
            <p className="tabular text-base font-semibold text-slate-900">
              <LineAmount line={line} currency={props.currency} />
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModernLayout(props: LayoutProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-[#0B4F6C] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/70">
              {props.organizationName}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {props.config.singular}
            </h2>
          </div>
          <p className="max-w-xs text-right text-xs text-white/75">{props.config.effect}</p>
        </div>
      </div>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <FormStatus state={props.state} />
        <HeaderFields props={props} />
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-800">Line items</h3>
          </div>
          <ClassicLinesTable props={props} quantityLabel="Qty" denser={false} />
        </div>
        <NotesFields props={props} />
      </CardContent>
    </Card>
  )
}

function ClassicLinesTable({
  props,
  quantityLabel,
  denser = true,
}: {
  props: LayoutProps
  quantityLabel: string
  denser?: boolean
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-56 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Product or service
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
              <th className="w-24 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                {quantityLabel}
              </th>
              <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Price</th>
              <th className="w-20 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Disc %</th>
              {props.showTax ? (
                <th className="w-40 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tax</th>
              ) : null}
              <th className="w-28 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {props.lines.map((line) => (
              <tr key={line.key} className="border-b last:border-0">
                <td className={cn('px-2', denser ? 'py-1.5' : 'py-2.5')}>
                  <EntityPicker
                    kind="item"
                    options={props.itemOptions}
                    value={line.itemId || null}
                    onChange={(next) => props.chooseItem(line.key, next ?? '')}
                    placeholder="Item"
                    clearable
                  />
                </td>
                <td className={cn('px-2', denser ? 'py-1.5' : 'py-2.5')}>
                  <Input
                    aria-label="Description"
                    value={line.description}
                    onChange={(event) => props.update(line.key, { description: event.target.value })}
                  />
                </td>
                <td className={cn('px-2', denser ? 'py-1.5' : 'py-2.5')}>
                  <Input
                    aria-label={quantityLabel}
                    inputMode="decimal"
                    className="tabular text-right"
                    value={line.quantity}
                    onChange={(event) => props.update(line.key, { quantity: event.target.value })}
                  />
                </td>
                <td className={cn('px-2', denser ? 'py-1.5' : 'py-2.5')}>
                  <Input
                    aria-label="Unit price"
                    inputMode="decimal"
                    className="tabular text-right"
                    value={line.unitPrice}
                    onChange={(event) => props.update(line.key, { unitPrice: event.target.value })}
                  />
                </td>
                <td className={cn('px-2', denser ? 'py-1.5' : 'py-2.5')}>
                  <Input
                    aria-label="Discount percent"
                    inputMode="decimal"
                    className="tabular text-right"
                    value={line.discountPercent}
                    onChange={(event) => props.update(line.key, { discountPercent: event.target.value })}
                  />
                </td>
                {props.showTax ? (
                  <td className={cn('px-2', denser ? 'py-1.5' : 'py-2.5')}>
                    <NativeSelect
                      aria-label="Tax code"
                      value={line.taxCodeId}
                      onChange={(event) => props.update(line.key, { taxCodeId: event.target.value })}
                      className="px-2"
                    >
                      <option value="">No tax</option>
                      {props.taxCodes.map((code) => (
                        <option key={code.id} value={code.id}>
                          {code.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                ) : null}
                <td className={cn('tabular px-3 text-right', denser ? 'py-1.5' : 'py-2.5')}>
                  <LineAmount line={line} currency={props.currency} />
                </td>
                <td className={cn('px-1', denser ? 'py-1.5' : 'py-2.5')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove line"
                    disabled={props.lines.length <= 1}
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

      <div className="flex flex-wrap items-start justify-between gap-4 border-t p-3">
        <Button type="button" variant="outline" size="sm" onClick={props.addLine}>
          <PlusIcon /> Add line
        </Button>
        <TotalsBlock props={props} />
      </div>
    </>
  )
}
