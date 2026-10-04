'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, PackageIcon, PlusIcon } from 'lucide-react'
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
import { createItemForm, updateItemForm } from '@/app/(app)/items/actions'
import type { ItemType } from '@prisma/client'

export type ItemValues = {
  id?: string
  sku?: string | null
  name?: string | null
  description?: string | null
  type?: ItemType
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
}

/** The raw chart. Every account selector orders it rather than filtering it. */
export type AccountOption = AccountChoice
export type SimpleOption = { id: string; label: string }

const TYPE_HELP: Record<ItemType, string> = {
  SERVICE: 'Labour or a service. Needs an income account only. No stock is tracked.',
  NON_INVENTORY:
    'Goods bought and resold without tracking stock levels. Selling one will NOT reduce any stock figure and posts no cost — the purchase was expensed when you bought it.',
  INVENTORY:
    'Goods with tracked quantity and cost. Selling one moves inventory and posts cost of goods sold in the same journal as the sale.',
}

/** Cannot be changed later, so it is worth being blunt about at the moment of choosing. */
const TYPE_WARNING: Partial<Record<ItemType, string>> = {
  SERVICE: 'Stock is never tracked for a service. This cannot be changed later.',
  NON_INVENTORY:
    'This item will not appear on the Inventory screen and its quantity will never change, however many you sell. If you want to count this one, choose Inventory product — the type cannot be changed after the item is created.',
}

export function NewItemButton(props: {
  accounts: AccountOption[]
  taxCodes: SimpleOption[]
  categories: SimpleOption[]
  stores?: (SimpleOption & { isOffice?: boolean })[]
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
  const [type, setType] = useState<ItemType>(item?.type ?? 'NON_INVENTORY')
  const handled = useRef(false)

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

  /**
   * Four views of the *same* chart. Each puts the accounts the field normally
   * wants at the top and keeps everything else selectable underneath — a
   * business that posts its sales to an "Other income" account should not have
   * to rename it before it can pick it.
   */
  const income = useMemo(
    () => accountOptions(accounts, { prefer: ['INCOME', 'OTHER_INCOME', 'SALES_DISCOUNTS'], preferTypes: ['REVENUE'] }),
    [accounts],
  )
  const expense = useMemo(
    () => accountOptions(accounts, { prefer: ['OPERATING_EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE'], preferTypes: ['EXPENSE'] }),
    [accounts],
  )
  const cogs = useMemo(
    () => accountOptions(accounts, { prefer: ['COST_OF_GOODS_SOLD'], preferTypes: ['EXPENSE'] }),
    [accounts],
  )
  const inventory = useMemo(
    () => accountOptions(accounts, { prefer: ['INVENTORY', 'OTHER_CURRENT_ASSET'], preferTypes: ['ASSET'] }),
    [accounts],
  )

  // Controlled, because they are comboboxes rather than <select>s and because
  // switching to Inventory pre-selects the usual stock and cost accounts.
  const [incomeAccountId, setIncomeAccountId] = useState(item?.incomeAccountId ?? '')
  const [expenseAccountId, setExpenseAccountId] = useState(item?.expenseAccountId ?? '')
  const [cogsAccountId, setCogsAccountId] = useState(item?.cogsAccountId ?? '')
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

  const chooseType = (next: ItemType) => {
    setType(next)
    if (next !== 'INVENTORY') {
      setInventoryAccountId('')
      setCogsAccountId('')
      setOpeningQuantity('')
      return
    }
    // The accounts a tracked item cannot do without, filled in from the chart's
    // own stock and cost-of-sales accounts so the common case needs no thought.
    if (!inventoryAccountId) {
      setInventoryAccountId(accounts.find((a) => a.subtype === 'INVENTORY')?.id ?? '')
    }
    if (!cogsAccountId) {
      setCogsAccountId(accounts.find((a) => a.subtype === 'COST_OF_GOODS_SOLD')?.id ?? '')
    }
  }

  const e = state.fieldErrors

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New item' : `Edit ${item?.name}`}</DialogTitle>
          {recorded ? <p className="text-xs text-muted-foreground">{recorded}</p> : null}
        </DialogHeader>

        <form action={formAction} className="mt-4 space-y-5">
          <FormStatus state={state} />
          {item?.id ? <input type="hidden" name="id" value={item.id} /> : null}
          {mode === 'edit' ? <input type="hidden" name="type" value={type} /> : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field name="name" label="Name" required error={e?.name}>
              <Input
                {...fieldProps('name', e?.name)}
                defaultValue={item?.name ?? defaultName ?? ''}
                autoFocus
                required
              />
            </Field>
            <Field name="sku" label="SKU" error={e?.sku}>
              <Input {...fieldProps('sku', e?.sku)} defaultValue={item?.sku ?? ''} />
            </Field>
          </div>

          <Field name="type" label="Type" hint={TYPE_HELP[type]} required error={e?.type}>
            {mode === 'create' ? (
              <NativeSelect
                {...fieldProps('type', e?.type, true)}
                value={type}
                onChange={(event) => chooseType(event.target.value as ItemType)}
              >
                <option value="SERVICE">Service</option>
                <option value="NON_INVENTORY">Non-inventory product</option>
                <option value="INVENTORY">Inventory product</option>
              </NativeSelect>
            ) : (
              <Input
                id="type"
                value={
                  type === 'SERVICE' ? 'Service' : type === 'INVENTORY' ? 'Inventory product' : 'Non-inventory product'
                }
                disabled
                readOnly
                aria-describedby="type-hint"
              />
            )}
          </Field>

          {mode === 'create' && TYPE_WARNING[type] ? (
            <p className="-mt-2 flex gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs text-muted-foreground">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>{TYPE_WARNING[type]}</span>
            </p>
          ) : null}

          {type === 'INVENTORY' ? (
            <p className="-mt-2 flex gap-2 rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <PackageIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Stock is part of this item, not a separate system. Anything entered under{' '}
                <strong>Stock setup</strong> below posts as a real opening movement — into the inventory
                account, against Opening Balance Equity — so the item is countable and sellable the moment
                it is created. After that, stock moves through bills, invoices and adjustments.
              </span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="categoryId" label="Category" error={e?.categoryId}>
              <NativeSelect
                {...fieldProps('categoryId', e?.categoryId)}
                defaultValue={item?.categoryId ?? ''}
              >
                <option value="">— none —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field name="unitOfMeasure" label="Unit" error={e?.unitOfMeasure}>
              <Input
                {...fieldProps('unitOfMeasure', e?.unitOfMeasure)}
                defaultValue={item?.unitOfMeasure ?? ''}
                placeholder="kg, piece, roll"
              />
            </Field>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Selling</p>

            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field name="salesPrice" label={`Price (${currency})`} error={e?.salesPrice}>
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
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Buying</p>

            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-4">
                <Field
                  name="purchaseCost"
                  label={`Cost (${currency})`}
                  hint={
                    type === 'INVENTORY'
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
                      type === 'INVENTORY' && item?.averageCost && Number(item.averageCost) !== 0
                        ? item.averageCost
                        : (item?.purchaseCost ?? '')
                    }
                  />
                </Field>

                {type === 'INVENTORY' ? (
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

              {type === 'INVENTORY' ? (
                <Field
                  name="cogsAccountId"
                  label="Cost of goods sold account"
                  hint="Posted in the same journal as the sale, so gross margin is right on the day."
                  required
                  error={e?.cogsAccountId}
                >
                  <AccountPicker
                    id="cogsAccountId"
                    name="cogsAccountId"
                    options={cogs}
                    value={cogsAccountId || null}
                    onChange={(next) => setCogsAccountId(next ?? '')}
                    required
                    error={e?.cogsAccountId}
                  />
                </Field>
              ) : (
                <Field name="expenseAccountId" label="Expense account" error={e?.expenseAccountId}>
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
              )}
            </div>

            {type === 'INVENTORY' ? (
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
                <Field name="storeId" label="Store" hint="Where this item is kept. A new item posts to that store’s account." error={e?.storeId}>
                  <NativeSelect
                    {...fieldProps('storeId', e?.storeId)}
                    defaultValue={item?.storeId ?? office?.id ?? ''}
                    onChange={(event) => {
                      const store = stores.find((row) => row.id === event.target.value)
                      if (store && mode === 'create') {
                        const account = accounts.find((row) => row.name === store.label && row.subtype === 'INVENTORY')
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
          </div>

          {type === 'INVENTORY' && mode === 'create' ? (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Stock setup
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    What is on the shelf today, and what it cost. Leave the quantity blank for an item you
                    have not received yet — it can be received on a bill or counted in later.
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
      </DialogContent>
    </Dialog>
  )
}
