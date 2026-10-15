'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { usePropState } from '@/lib/use-prop-state'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, ArrowLeftIcon, PackageIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { AccountPicker } from '@/components/forms/account-picker'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { DateField } from '@/components/ui/date-field'
import { Separator } from '@/components/ui/separator'
import { accountOptions, type AccountChoice } from '@/lib/account-options'
import {
  isStockTracked,
  itemTypeLabel,
  profileForType,
} from '@/lib/item-types'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { createCategory, createItemForm, updateItemForm } from '@/app/(app)/items/actions'
import type { ItemType } from '@prisma/client'
import { ItemTypePicker } from '@/components/master-data/item-type-picker'
import {
  ItemComponentsEditor,
  type CatalogItem,
  type ComponentRow,
} from '@/components/master-data/item-components-editor'
import { MergeIntoDialog } from '@/components/master-data/merge-into-dialog'

export type ItemValues = {
  id?: string
  sku?: string | null
  barcode?: string | null
  name?: string | null
  description?: string | null
  type?: ItemType
  /**
   * True when the item has never appeared on a document or journal, so its
   * type may still be changed. Omitted / false locks the field.
   */
  typeEditable?: boolean
  unitOfMeasure?: string | null
  salesDescription?: string | null
  salesPrice?: string | null
  incomeAccountId?: string | null
  isTaxable?: boolean
  salesTaxCodeId?: string | null
  purchaseDescription?: string | null
  purchaseCost?: string | null
  /** Weighted-average cost from stock movements — display only, not editable. */
  averageCost?: string | null
  expenseAccountId?: string | null
  inventoryAccountId?: string | null
  cogsAccountId?: string | null
  reorderPoint?: string | null
  categoryId?: string | null
  storeId?: string | null
  availableInPos?: boolean
  printGroupItems?: boolean
  itemPaymentMethod?: string | null
  depositAccountId?: string | null
  components?: ComponentRow[]
}

/** The raw chart. Every account selector orders it rather than filtering it. */
export type AccountOption = AccountChoice
export type SimpleOption = { id: string; label: string }

export function NewItemButton(props: {
  accounts: AccountOption[]
  taxCodes: SimpleOption[]
  categories: SimpleOption[]
  stores?: (SimpleOption & { isOffice?: boolean })[]
  catalogItems?: CatalogItem[]
  currency: string
  today?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> New item
      </Button>
      {open ? <ItemDialog {...props} mode="create" onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function ItemDialog({
  mode,
  item,
  accounts,
  taxCodes,
  categories,
  stores = [],
  catalogItems = [],
  currency,
  today,
  onClose,
  defaultName,
  onCreated,
  recorded,
}: {
  mode: 'create' | 'edit'
  item?: ItemValues
  accounts: AccountOption[]
  taxCodes: SimpleOption[]
  categories: SimpleOption[]
  stores?: (SimpleOption & { isOffice?: boolean })[]
  catalogItems?: CatalogItem[]
  currency: string
  /** Default date for opening stock. */
  today?: string
  onClose: () => void
  /** Pre-fills the name, when the dialog was opened by typing one into a picker. */
  defaultName?: string
  /** Hands the new record back to whatever opened this. */
  onCreated?: (record: { id: string; label: string }) => void
  /** Who entered this item, and who last changed it. */
  recorded?: string | null
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(
    mode === 'create' ? createItemForm : updateItemForm,
    idleState,
  )
  const [step, setStep] = useState<'pick' | 'form'>(mode === 'edit' ? 'form' : 'pick')
  const [type, setType] = useState<ItemType | null>(item?.type ?? null)
  const profile = type ? profileForType(type) : null
  const stock = type ? isStockTracked(type) : false
  const [categoryOptions, setCategoryOptions] = usePropState(categories)
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [componentRows, setComponentRows] = useState<ComponentRow[]>(
    () => item?.components?.length ? item.components : [{ itemId: '', quantity: '1' }],
  )
  const [depositToBank, setDepositToBank] = useState(() => {
    if (!item?.depositAccountId) return false
    const account = accounts.find((row) => row.id === item.depositAccountId)
    return account?.subtype === 'BANK'
  })
  const handled = useRef(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  async function saveNewCategory() {
    const name = newCategoryName.trim()
    if (!name || savingCategory) return
    setSavingCategory(true)
    try {
      const result = await createCategory({ name })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      const next = { id: result.data.id, label: result.data.name }
      setCategoryOptions((current) =>
        current.some((row) => row.id === next.id)
          ? current
          : [...current, next].sort((a, b) => a.label.localeCompare(b.label)),
      )
      setCategoryId(next.id)
      setAddingCategory(false)
      setNewCategoryName('')
      toast.success(`Category “${next.label}” added.`)
      router.refresh()
    } finally {
      setSavingCategory(false)
    }
  }

  useEffect(() => {
    if (state.status === 'success' && !handled.current) {
      handled.current = true
      toast.success(state.message ?? 'Saved.')
      if (state.created) onCreated?.({ id: state.created.id, label: state.created.label ?? '' })
      router.refresh()
      onClose()
    }
    if (state.status !== 'success') handled.current = false
  }, [state, router, onClose, onCreated])

  const income = useMemo(
    () =>
      accountOptions(accounts, {
        prefer: profile?.discountIncome
          ? ['SALES_DISCOUNTS', 'INCOME', 'OTHER_INCOME', 'OPERATING_EXPENSE', 'OTHER_EXPENSE']
          : ['INCOME', 'OTHER_INCOME', 'SALES_DISCOUNTS'],
        preferTypes: profile?.discountIncome ? ['REVENUE', 'EXPENSE'] : ['REVENUE'],
      }),
    [accounts, profile?.discountIncome],
  )
  const expense = useMemo(
    () => accountOptions(accounts, { prefer: ['OPERATING_EXPENSE', 'OTHER_EXPENSE'], preferTypes: ['EXPENSE'] }),
    [accounts],
  )
  const cogsSystem = useMemo(
    () =>
      accounts.find((account) => account.systemKey === 'COGS') ??
      accounts.find((account) => account.subtype === 'COST_OF_GOODS_SOLD') ??
      null,
    [accounts],
  )
  const inventory = useMemo(
    () => accountOptions(accounts, { prefer: ['INVENTORY', 'OTHER_CURRENT_ASSET'], preferTypes: ['ASSET'] }),
    [accounts],
  )
  const depositAccounts = useMemo(
    () => accountOptions(accounts, { prefer: ['UNDEPOSITED_FUNDS', 'BANK'], preferTypes: ['ASSET'] }),
    [accounts],
  )
  const undeposited = useMemo(
    () =>
      accounts.find((a) => a.subtype === 'UNDEPOSITED_FUNDS' || a.systemKey === 'UNDEPOSITED_FUNDS') ??
      null,
    [accounts],
  )

  const [incomeAccountId, setIncomeAccountId] = useState(item?.incomeAccountId ?? '')
  const [expenseAccountId, setExpenseAccountId] = useState(item?.expenseAccountId ?? '')
  const [depositAccountId, setDepositAccountId] = useState(
    item?.depositAccountId ?? undeposited?.id ?? '',
  )
  const office = stores.find((store) => store.isOffice)
  const [inventoryAccountId, setInventoryAccountId] = useState(() => {
    if (item?.inventoryAccountId) return item.inventoryAccountId
    if (mode === 'create' && office) {
      const account = accounts.find((row) => row.name === office.label && row.subtype === 'INVENTORY')
      return account?.id ?? ''
    }
    return ''
  })
  const [openingQuantity, setOpeningQuantity] = useState('')
  const [openingUnitCost, setOpeningUnitCost] = useState(item?.purchaseCost ?? '')
  const [openingDate, setOpeningDate] = useState(today ?? '')

  const pickType = (next: ItemType) => {
    setType(next)
    setStep('form')
    if (!isStockTracked(next)) {
      setInventoryAccountId('')
      setOpeningQuantity('')
      return
    }
    if (!inventoryAccountId) {
      setInventoryAccountId(accounts.find((a) => a.subtype === 'INVENTORY')?.id ?? '')
    }
  }

  const e = state.fieldErrors
  const catalog = useMemo(() => {
    const base = catalogItems.filter((row) => row.id !== item?.id)
    if (type === 'INVENTORY_ASSEMBLY') {
      return base.filter((row) => row.type === 'INVENTORY' || row.type === 'INVENTORY_ASSEMBLY')
    }
    return base
  }, [catalogItems, item?.id, type])
  const estimatedBomCost = useMemo(() => {
    if (type !== 'INVENTORY_ASSEMBLY') return null
    const byId = new Map(catalogItems.map((row) => [row.id, row]))
    let total = ZERO
    for (const row of componentRows) {
      if (!row.itemId) continue
      const avg = byId.get(row.itemId)?.averageCost
      const qty = Number(row.quantity)
      if (!avg || !Number.isFinite(qty) || qty <= 0) continue
      total = total.plus(new Decimal(avg).times(qty))
    }
    return total.isZero() ? null : total
  }, [type, componentRows, catalogItems])
  const canChangeType = mode === 'create' || Boolean(item?.typeEditable)

  const categoryField = (
    <Field name="categoryId" label="Category" error={e?.categoryId}>
      <div className="space-y-2">
        <NativeSelect
          {...fieldProps('categoryId', e?.categoryId)}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">— none —</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </NativeSelect>
        {addingCategory ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category name"
              autoFocus
              className="min-w-0 flex-1"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveNewCategory()
                }
                if (event.key === 'Escape') {
                  setAddingCategory(false)
                  setNewCategoryName('')
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={savingCategory || !newCategoryName.trim()}
              onClick={() => void saveNewCategory()}
            >
              {savingCategory ? 'Saving…' : 'Add'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={savingCategory}
              onClick={() => {
                setAddingCategory(false)
                setNewCategoryName('')
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setAddingCategory(true)}
          >
            + Add category
          </button>
        )}
      </div>
    </Field>
  )

  const unitField = (
    <Field name="unitOfMeasure" label="Unit" error={e?.unitOfMeasure}>
      <Input
        {...fieldProps('unitOfMeasure', e?.unitOfMeasure)}
        defaultValue={item?.unitOfMeasure ?? ''}
        placeholder="kg, piece, roll"
      />
    </Field>
  )

  const posAndTax = type && type !== 'SUBTOTAL' && type !== 'GROUP' && type !== 'PAYMENT' ? (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input type="hidden" name="availableInPos" value="false" />
        <input
          type="checkbox"
          name="availableInPos"
          value="true"
          defaultChecked={item?.availableInPos !== false && type !== 'DISCOUNT'}
          className="size-4 rounded border"
        />
        Available in Point of Sale
      </label>
      {taxCodes.length > 0 ? (
        <Field name="salesTaxCodeId" label="Default sales tax" error={e?.salesTaxCodeId}>
          <NativeSelect
            {...fieldProps('salesTaxCodeId', e?.salesTaxCodeId)}
            defaultValue={item?.salesTaxCodeId ?? ''}
          >
            <option value="">— none —</option>
            {taxCodes.map((code) => (
              <option key={code.id} value={code.id}>
                {code.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
    </>
  ) : null

  return (
    <>
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent size={step === 'pick' ? 'xl' : 'lg'}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit'
              ? `Edit ${item?.name}`
              : step === 'pick'
                ? 'New item'
                : `New item — ${type ? itemTypeLabel(type) : ''}`}
          </DialogTitle>
          {recorded ? <p className="text-xs text-muted-foreground">{recorded}</p> : null}
        </DialogHeader>

        {step === 'pick' && canChangeType ? (
          <div className="mt-4 space-y-4">
            <ItemTypePicker value={type} onPick={pickType} />
            <div className="flex justify-end gap-2">
              {mode === 'edit' && type ? (
                <Button type="button" variant="outline" onClick={() => setStep('form')}>
                  Back
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : type && profile ? (
          <form action={formAction} className="mt-4 space-y-5">
            <FormStatus state={state} />
            {mode === 'edit' && item?.id && state.mergeClash ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Merge this item into “{state.mergeClash.name}”?
                </span>
                <Button type="button" size="sm" onClick={() => setMergeOpen(true)}>
                  Merge…
                </Button>
              </div>
            ) : null}
            {item?.id ? <input type="hidden" name="id" value={item.id} /> : null}
            <input type="hidden" name="type" value={type} />

            {canChangeType ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{itemTypeLabel(type)}</p>
                  <p className="text-xs text-muted-foreground">{profile.blurb}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setStep('pick')}>
                  <ArrowLeftIcon className="size-3.5" />
                  Change type
                </Button>
              </div>
            ) : (
              <Field
                name="type"
                label="Type"
                hint="Type is locked because this item already appears on a document or journal."
              >
                <Input id="type" value={itemTypeLabel(type)} disabled readOnly />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Field name="name" label="Name" required error={e?.name}>
                <Input
                  {...fieldProps('name', e?.name)}
                  defaultValue={item?.name ?? defaultName ?? ''}
                  autoFocus
                  required
                />
              </Field>
              {type !== 'SUBTOTAL' && type !== 'PAYMENT' ? (
                <Field name="sku" label="SKU" error={e?.sku}>
                  <Input {...fieldProps('sku', e?.sku)} defaultValue={item?.sku ?? ''} />
                </Field>
              ) : (
                <div />
              )}
            </div>

            {stock || type === 'NON_INVENTORY' || type === 'SERVICE' || type === 'OTHER_CHARGE' ? (
              <Field
                name="barcode"
                label="Barcode"
                hint="Click this field, scan the package with a USB/Bluetooth scanner (or type the code), then Save. POS adds the item when that code is scanned at the till."
                error={e?.barcode}
              >
                <Input
                  {...fieldProps('barcode', e?.barcode)}
                  defaultValue={item?.barcode ?? ''}
                  placeholder="Scan or type barcode"
                  autoComplete="off"
                  data-item-barcode="true"
                  onKeyDown={(event) => {
                    // Scanners end with Enter — keep the code in the field; do not submit the form.
                    if (event.key === 'Enter') event.preventDefault()
                  }}
                />
              </Field>
            ) : null}

            {mode === 'create' && !stock && type !== 'SUBTOTAL' && type !== 'GROUP' && type !== 'PAYMENT' ? (
              <p className="-mt-2 flex gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs text-muted-foreground">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>
                  This type never tracks stock quantity. You can still change the type until the item
                  is used on a document or journal.
                </span>
              </p>
            ) : null}

            {stock ? (
              <p className="-mt-2 flex gap-2 rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <PackageIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Stock is part of this item. <strong>Stock setup</strong> below posts a real opening
                  movement into the inventory account (against Opening Balance Equity).
                </span>
              </p>
            ) : null}

            {type !== 'SUBTOTAL' && type !== 'PAYMENT' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {categoryField}
                {unitField}
              </div>
            ) : null}

            <Separator />

            {/* —— SERVICE —— */}
            {type === 'SERVICE' ? (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sales information
                </p>
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <Field name="salesPrice" label={`Rate (${currency})`} error={e?.salesPrice}>
                    <Input
                      {...fieldProps('salesPrice', e?.salesPrice)}
                      inputMode="decimal"
                      className="tabular"
                      defaultValue={item?.salesPrice ?? ''}
                    />
                  </Field>
                  <Field
                    name="incomeAccountId"
                    label="Income account"
                    hint="Where revenue from this service is posted."
                    required
                    error={e?.incomeAccountId}
                  >
                    <AccountPicker
                      id="incomeAccountId"
                      name="incomeAccountId"
                      options={income}
                      value={incomeAccountId || null}
                      onChange={(next) => setIncomeAccountId(next ?? '')}
                      required
                      error={e?.incomeAccountId}
                    />
                  </Field>
                </div>
                <Field
                  name="expenseAccountId"
                  label="Expense account (optional)"
                  hint="When a subcontractor or partner performs this service."
                  error={e?.expenseAccountId}
                >
                  <AccountPicker
                    id="expenseAccountId"
                    name="expenseAccountId"
                    options={expense}
                    value={expenseAccountId || null}
                    onChange={(next) => setExpenseAccountId(next ?? '')}
                    clearable
                    error={e?.expenseAccountId}
                  />
                </Field>
                {posAndTax}
              </div>
            ) : null}

            {/* —— OTHER CHARGE —— */}
            {type === 'OTHER_CHARGE' ? (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Charge details
                </p>
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <Field name="salesPrice" label={`Amount or % (${currency})`} error={e?.salesPrice}>
                    <Input
                      {...fieldProps('salesPrice', e?.salesPrice)}
                      inputMode="decimal"
                      className="tabular"
                      defaultValue={item?.salesPrice ?? ''}
                    />
                  </Field>
                  <Field
                    name="incomeAccountId"
                    label="Account"
                    hint="Income account for this charge on sales."
                    required
                    error={e?.incomeAccountId}
                  >
                    <AccountPicker
                      id="incomeAccountId"
                      name="incomeAccountId"
                      options={income}
                      value={incomeAccountId || null}
                      onChange={(next) => setIncomeAccountId(next ?? '')}
                      required
                      error={e?.incomeAccountId}
                    />
                  </Field>
                </div>
                <Field
                  name="expenseAccountId"
                  label="Expense account (optional)"
                  hint="When you purchase this charge from a vendor."
                  error={e?.expenseAccountId}
                >
                  <AccountPicker
                    id="expenseAccountId"
                    name="expenseAccountId"
                    options={expense}
                    value={expenseAccountId || null}
                    onChange={(next) => setExpenseAccountId(next ?? '')}
                    clearable
                    error={e?.expenseAccountId}
                  />
                </Field>
                {posAndTax}
              </div>
            ) : null}

            {/* —— DISCOUNT —— */}
            {type === 'DISCOUNT' ? (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Discount
                </p>
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <Field
                    name="salesPrice"
                    label={`Amount (${currency})`}
                    hint="How much this discount reduces the sale by default."
                    error={e?.salesPrice}
                  >
                    <Input
                      {...fieldProps('salesPrice', e?.salesPrice)}
                      inputMode="decimal"
                      className="tabular"
                      defaultValue={item?.salesPrice ?? ''}
                    />
                  </Field>
                  <Field
                    name="incomeAccountId"
                    label="Discount account"
                    hint="Contra-income (sales discounts) or a separate expense account prepared for discounts."
                    required
                    error={e?.incomeAccountId}
                  >
                    <AccountPicker
                      id="incomeAccountId"
                      name="incomeAccountId"
                      options={income}
                      value={incomeAccountId || null}
                      onChange={(next) => setIncomeAccountId(next ?? '')}
                      required
                      error={e?.incomeAccountId}
                    />
                  </Field>
                </div>
                {posAndTax}
              </div>
            ) : null}

            {/* —— SUBTOTAL —— */}
            {type === 'SUBTOTAL' ? (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                A subtotal line totals the items above it on a sales form. No price or account is stored
                on the item — only the name and description appear on documents.
              </p>
            ) : null}

            {/* —— GROUP —— */}
            {type === 'GROUP' ? (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="printGroupItems" value="false" />
                  <input
                    type="checkbox"
                    name="printGroupItems"
                    value="true"
                    defaultChecked={item?.printGroupItems !== false}
                    className="size-4 rounded border"
                  />
                  Print items in group
                </label>
                <ItemComponentsEditor
                  rows={componentRows}
                  onChange={setComponentRows}
                  catalog={catalog}
                  label="Group items"
                />
              </div>
            ) : null}

            {/* —— PAYMENT —— */}
            {type === 'PAYMENT' ? (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Payment
                </p>
                <Field name="itemPaymentMethod" label="Payment method" error={e?.itemPaymentMethod}>
                  <NativeSelect
                    {...fieldProps('itemPaymentMethod', e?.itemPaymentMethod)}
                    defaultValue={item?.itemPaymentMethod ?? 'CASH'}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="MOBILE_MONEY">Mobile money</option>
                    <option value="OTHER">Other</option>
                  </NativeSelect>
                </Field>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Deposit to</p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="depositMode"
                      className="mt-1"
                      checked={!depositToBank}
                      onChange={() => {
                        setDepositToBank(false)
                        setDepositAccountId(undeposited?.id ?? '')
                      }}
                    />
                    <span>
                      Group with other undeposited funds
                      {undeposited ? (
                        <span className="block text-xs text-muted-foreground">
                          {undeposited.code} — {undeposited.name}
                        </span>
                      ) : (
                        <span className="block text-xs text-destructive">
                          Undeposited Funds is missing from the chart.
                        </span>
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="depositMode"
                      className="mt-1"
                      checked={depositToBank}
                      onChange={() => setDepositToBank(true)}
                    />
                    <span className="flex-1">
                      Deposit To
                      <AccountPicker
                        id="depositAccountId"
                        name={depositToBank ? 'depositAccountId' : undefined}
                        options={depositAccounts}
                        value={depositToBank ? depositAccountId || null : null}
                        onChange={(next) => setDepositAccountId(next ?? '')}
                        required={depositToBank}
                        error={e?.depositAccountId}
                        className="mt-1"
                      />
                    </span>
                  </label>
                  {!depositToBank ? (
                    <input type="hidden" name="depositAccountId" value={depositAccountId} />
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* —— NON-INVENTORY / INVENTORY / ASSEMBLY —— */}
            {(type === 'NON_INVENTORY' || stock) ? (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Selling
                </p>
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <Field name="salesPrice" label={`Sales price (${currency})`} error={e?.salesPrice}>
                    <Input
                      {...fieldProps('salesPrice', e?.salesPrice)}
                      inputMode="decimal"
                      className="tabular"
                      defaultValue={item?.salesPrice ?? ''}
                    />
                  </Field>
                  <Field
                    name="incomeAccountId"
                    label="Income account"
                    hint="Where revenue from this item is posted."
                    required
                    error={e?.incomeAccountId}
                  >
                    <AccountPicker
                      id="incomeAccountId"
                      name="incomeAccountId"
                      options={income}
                      value={incomeAccountId || null}
                      onChange={(next) => setIncomeAccountId(next ?? '')}
                      required
                      error={e?.incomeAccountId}
                    />
                  </Field>
                </div>
                {posAndTax}

                <Separator />

                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Buying
                </p>
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <div className="space-y-4">
                    <Field
                      name="purchaseCost"
                      label={`Cost (${currency})`}
                      hint={
                        stock
                          ? 'Follows average cost whenever stock moves. Edit only as a starting figure before the first receipt.'
                          : undefined
                      }
                      error={e?.purchaseCost}
                    >
                      <Input
                        {...fieldProps('purchaseCost', e?.purchaseCost)}
                        inputMode="decimal"
                        className="tabular"
                        defaultValue={
                          stock && item?.averageCost && Number(item.averageCost) !== 0
                            ? item.averageCost
                            : (item?.purchaseCost ?? '')
                        }
                      />
                    </Field>
                    {stock ? (
                      <Field
                        name="averageCost"
                        label="Average cost"
                        hint="What the stock is really sitting at — updates when you buy, sell, adjust, or transfer. Not editable."
                      >
                        <Input
                          id="averageCost"
                          readOnly
                          tabIndex={-1}
                          className="tabular text-muted-foreground"
                          defaultValue={
                            item?.averageCost && Number(item.averageCost) !== 0
                              ? item.averageCost
                              : '—'
                          }
                        />
                      </Field>
                    ) : null}
                  </div>
                  <Field
                    name={stock ? 'cogsAccountId' : 'expenseAccountId'}
                    label="Cost of goods sold"
                    hint={
                      stock
                        ? 'A sale posts this item’s average cost here, in the same journal as the sales price.'
                        : 'Buying this product posts the cost here. It is not an expense.'
                    }
                    error={e?.cogsAccountId ?? e?.expenseAccountId}
                  >
                    <input
                      type="hidden"
                      name={stock ? 'cogsAccountId' : 'expenseAccountId'}
                      value={cogsSystem?.id ?? ''}
                    />
                    <Input
                      id={stock ? 'cogsAccountId' : 'expenseAccountId'}
                      readOnly
                      tabIndex={-1}
                      value={
                        cogsSystem
                          ? `${cogsSystem.code} — ${cogsSystem.name}`
                          : 'Cost of Goods Sold is not on the chart'
                      }
                      className="text-muted-foreground"
                    />
                  </Field>
                </div>

                {stock ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      name="inventoryAccountId"
                      label="Inventory account"
                      hint="Where the value of stock on hand is held."
                      required
                      error={e?.inventoryAccountId}
                    >
                      <AccountPicker
                        id="inventoryAccountId"
                        name="inventoryAccountId"
                        options={inventory}
                        value={inventoryAccountId || null}
                        onChange={(next) => setInventoryAccountId(next ?? '')}
                        required
                        error={e?.inventoryAccountId}
                      />
                    </Field>
                    <Field
                      name="storeId"
                      label="Store"
                      hint="Where this item is kept. A new item posts to that store’s account."
                      error={e?.storeId}
                    >
                      <NativeSelect
                        {...fieldProps('storeId', e?.storeId)}
                        defaultValue={item?.storeId ?? office?.id ?? ''}
                        onChange={(event) => {
                          const store = stores.find((row) => row.id === event.target.value)
                          if (store && mode === 'create') {
                            const account = accounts.find(
                              (row) => row.name === store.label && row.subtype === 'INVENTORY',
                            )
                            if (account) setInventoryAccountId(account.id)
                          }
                        }}
                      >
                        <option value="">— no store —</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field name="reorderPoint" label="Reorder at" error={e?.reorderPoint}>
                      <Input
                        {...fieldProps('reorderPoint', e?.reorderPoint)}
                        inputMode="decimal"
                        className="tabular"
                        defaultValue={item?.reorderPoint ?? ''}
                      />
                    </Field>
                  </div>
                ) : null}

                {type === 'INVENTORY_ASSEMBLY' ? (
                  <>
                    <Separator />
                    <ItemComponentsEditor
                      rows={componentRows}
                      onChange={setComponentRows}
                      catalog={catalog}
                      label="Bill of materials"
                    />
                    <p className="text-xs text-muted-foreground">
                      Estimated cost from materials (average × qty):{' '}
                      <span className="font-medium tabular text-foreground">
                        {estimatedBomCost
                          ? formatMoney(estimatedBomCost, currency)
                          : '— add stocked parts with a cost'}
                      </span>
                      . Build assemblies under Inventory to put finished units on hand at that cost.
                      Sales price stays what you enter above.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            {stock && mode === 'create' ? (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Stock setup
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      What is on the shelf today, and what it cost. Leave the quantity blank for an item you
                      have not received yet.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field name="openingQuantity" label="Quantity on hand" error={e?.openingQuantity}>
                      <Input
                        {...fieldProps('openingQuantity', e?.openingQuantity)}
                        inputMode="decimal"
                        className="tabular"
                        placeholder="0"
                        value={openingQuantity}
                        onChange={(event) => setOpeningQuantity(event.target.value)}
                      />
                    </Field>
                    <Field
                      name="openingUnitCost"
                      label={`Cost each (${currency})`}
                      error={e?.openingUnitCost}
                    >
                      <Input
                        {...fieldProps('openingUnitCost', e?.openingUnitCost)}
                        inputMode="decimal"
                        className="tabular"
                        value={openingUnitCost ?? ''}
                        onChange={(event) => setOpeningUnitCost(event.target.value)}
                      />
                    </Field>
                    <Field name="openingDate" label="As at" error={e?.openingDate}>
                      <DateField
                        id="openingDate"
                        name="openingDate"
                        value={openingDate}
                        onChange={setOpeningDate}
                        today={today}
                      />
                    </Field>
                  </div>
                </div>
              </>
            ) : null}

            <Field name="description" label="Description" error={e?.description}>
              <Input {...fieldProps('description', e?.description)} defaultValue={item?.description ?? ''} />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <SubmitButton pendingLabel="Saving…">
                {mode === 'create' ? 'Create item' : 'Save changes'}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
    {mergeOpen && mode === 'edit' && item?.id && state.mergeClash ? (
      <MergeIntoDialog
        open
        onClose={() => setMergeOpen(false)}
        onMerged={onClose}
        kind="item"
        absorbId={item.id}
        absorbLabel={item.name ?? ''}
        preferredKeepId={state.mergeClash.id}
      />
    ) : null}
    </>
  )
}
