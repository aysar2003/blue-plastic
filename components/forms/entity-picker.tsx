'use client'

import * as React from 'react'
import type { AccountType } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { contactDialogOptions, itemDialogOptions } from '@/app/(app)/quick-create/actions'
import type { AccountOption, SimpleOption } from '@/components/master-data/item-dialog'
import type { Option } from '@/components/master-data/contact-dialog'
import type { AccountPickerOption } from '@/lib/account-options'

// Loaded on demand: a form that never opens the create dialog should not pay for
// the dialog's code, and these two are among the largest components in the app.
const ContactDialog = React.lazy(() =>
  import('@/components/master-data/contact-dialog').then((m) => ({ default: m.ContactDialog })),
)
const ItemDialog = React.lazy(() =>
  import('@/components/master-data/item-dialog').then((m) => ({ default: m.ItemDialog })),
)

export type PickerOption = {
  id: string
  label: string
  hint?: string
  group?: string
  /** When the option is a ledger account, show its statement-type mark. */
  accountType?: AccountType
}

export type CreatableKind = 'customer' | 'vendor' | 'item'

type DialogData =
  | {
      kind: 'customer' | 'vendor'
      terms: Option[]
      expenseAccounts: AccountPickerOption[]
      today: string
      currency: string
    }
  | {
      kind: 'item'
      accounts: AccountOption[]
      taxCodes: SimpleOption[]
      categories: SimpleOption[]
      today: string
    }

/**
 * A searchable picker for a list of records.
 *
 * `kind` decides whether the list can be added to from inside the form. Choosing
 * "Add" opens that record's **real** dialog with the typed name filled in — not a
 * shortened version of it. An item created from an invoice line still needs its
 * income, inventory and cost-of-sales accounts; a form that quietly picked those
 * would produce an item that posts to the wrong place, which is worse than
 * making somebody fill in three fields.
 *
 * The dialog's own option lists are fetched when it is opened, so a form that
 * never needs them never loads them.
 *
 * Accounts are deliberately not creatable this way: an account needs a type and
 * a subtype that determine where it lands on the balance sheet, and guessing
 * those from a name typed into a dropdown is how a chart of accounts becomes a
 * mess.
 */
export function EntityPicker({
  options,
  value,
  onChange,
  kind,
  name,
  id,
  placeholder,
  emptyMessage,
  clearable,
  disabled,
  required,
  error,
  className,
  currency = 'USD',
}: {
  options: PickerOption[]
  value: string | null
  onChange: (value: string | null) => void
  /** Omit to make the list search-only. */
  kind?: CreatableKind
  name?: string
  id?: string
  placeholder?: string
  emptyMessage?: string
  clearable?: boolean
  disabled?: boolean
  required?: boolean
  error?: string[]
  className?: string
  /** Needed by the item dialog, which shows prices. */
  currency?: string
}) {
  const router = useRouter()
  const [extra, setExtra] = React.useState<PickerOption[]>([])
  const [pendingName, setPendingName] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<DialogData | null>(null)

  const alphabetical =
    kind === 'item' ||
    options.some((option) => option.group != null && option.accountType == null)

  const merged: ComboboxOption[] = React.useMemo(
    () => {
      const unique = [...extra, ...options]
        // A newly created record appears here at once; after the refresh the
        // server list carries it too, and the duplicate has to go.
        .filter((option, index, all) => all.findIndex((other) => other.id === option.id) === index)
      const ordered = alphabetical
        ? [...unique].sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }),
          )
        : unique
      return ordered.map((option) => ({
        value: option.id,
        label: option.label,
        hint: option.hint,
        // One A–Z list. Keeping type headings would split names that sort together.
        group: alphabetical ? undefined : option.group,
        accountType: option.accountType,
      }))
    },
    [options, extra, alphabetical],
  )

  async function openCreate(label: string) {
    if (!kind) return
    setPendingName(label)

    if (kind === 'item') {
      const result = await itemDialogOptions(undefined)
      if (!result.ok) {
        toast.error(result.error.message)
        setPendingName(null)
        return
      }
      setDialog({ kind: 'item', ...result.data })
      return
    }

    const result = await contactDialogOptions(undefined)
    if (!result.ok) {
      toast.error(result.error.message)
      setPendingName(null)
      return
    }
    setDialog({ kind, ...result.data })
  }

  function created(record: { id: string; label: string }) {
    setExtra((current) => [{ id: record.id, label: record.label }, ...current])
    onChange(record.id)
    router.refresh()
  }

  function closeDialog() {
    setDialog(null)
    setPendingName(null)
  }

  return (
    <>
      <Combobox
        options={merged}
        value={value}
        onChange={onChange}
        name={name}
        id={id}
        placeholder={placeholder}
        emptyMessage={emptyMessage ?? (kind ? 'No match. Type a name to add one.' : 'Nothing found.')}
        clearable={clearable}
        disabled={disabled}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={error?.length ? `${name ?? id}-error` : undefined}
        className={className}
        onCreate={kind ? openCreate : undefined}
        createLabel={(label) => `Add “${label}”`}
      />

      {dialog ? (
        <React.Suspense fallback={null}>
          {dialog.kind === 'item' ? (
            <ItemDialog
              mode="create"
              accounts={dialog.accounts}
              taxCodes={dialog.taxCodes}
              categories={dialog.categories}
              currency={currency}
              today={dialog.today}
              defaultName={pendingName ?? ''}
              onCreated={created}
              onClose={closeDialog}
            />
          ) : (
            <ContactDialog
              side={dialog.kind}
              mode="create"
              terms={dialog.terms}
              expenseAccounts={dialog.expenseAccounts}
              today={dialog.today}
              currency={dialog.currency}
              defaultName={pendingName ?? ''}
              onCreated={created}
              onClose={closeDialog}
            />
          )}
        </React.Suspense>
      ) : null}
    </>
  )
}
