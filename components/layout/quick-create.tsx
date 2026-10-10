'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { contactDialogOptions, itemDialogOptions } from '@/app/(app)/quick-create/actions'
import type { AccountOption } from '@/components/master-data/item-dialog'
import type { AccountPickerOption } from '@/lib/account-options'
import { cn } from '@/lib/utils'
import { startNavigationProgress } from './navigation-progress'

const ContactDialog = React.lazy(() =>
  import('@/components/master-data/contact-dialog').then((m) => ({ default: m.ContactDialog })),
)
const ItemDialog = React.lazy(() =>
  import('@/components/master-data/item-dialog').then((m) => ({ default: m.ItemDialog })),
)

type Entry = {
  label: string
  permission?: string
} & ({ href: string } | { opens: 'customer' | 'vendor' | 'item' })

const COLUMNS: { heading: string; entries: Entry[] }[] = [
  {
    heading: 'Customers',
    entries: [
      { label: 'Invoice', href: '/sales/invoices/new', permission: 'invoice:create' },
      { label: 'Receive payment', href: '/payments/new', permission: 'payment:create' },
      { label: 'Sales receipt', href: '/sales/sales-receipts/new', permission: 'invoice:create' },
      { label: 'Estimate', href: '/sales/estimates/new', permission: 'invoice:create' },
      { label: 'Quotation', href: '/sales/quotations/new', permission: 'invoice:create' },
      { label: 'Credit memo', href: '/sales/credit-memos/new', permission: 'invoice:create' },
      { label: 'Customer statement', href: '/reports/statements/customer', permission: 'report:read' },
      { label: 'Refund receipt', href: '/sales/refunds/new', permission: 'invoice:create' },
      { label: 'Add customer', opens: 'customer', permission: 'customer:create' },
    ],
  },
  {
    heading: 'Vendors',
    entries: [
      { label: 'Bill', href: '/purchases/bills/new', permission: 'bill:create' },
      { label: 'Expense', href: '/purchases/expenses/new', permission: 'expense:create' },
      { label: 'Pay bills', href: '/bill-payments/new', permission: 'expense:create' },
      { label: 'Purchase order', href: '/purchases/purchase-orders/new', permission: 'bill:create' },
      { label: 'Receive items', href: '/purchases/purchase-orders?status=open', permission: 'bill:create' },
      { label: 'Delivery', href: '/purchases/delivery', permission: 'bill:read' },
      { label: 'Vendor credit', href: '/purchases/vendor-credits/new', permission: 'bill:create' },
      { label: 'Add vendor', opens: 'vendor', permission: 'vendor:create' },
    ],
  },
  {
    heading: 'Banking',
    entries: [
      { label: 'Bank deposit', href: '/banking/deposits/new', permission: 'bank:transact' },
      { label: 'Transfer', href: '/banking/transfers/new', permission: 'bank:transact' },
      { label: 'Import statement', href: '/banking/import', permission: 'bank:import' },
    ],
  },
  {
    heading: 'Other',
    entries: [
      { label: 'Journal entry', href: '/journals/new', permission: 'journal:create' },
      { label: 'Inventory adjustment', href: '/inventory/adjustments/new', permission: 'inventory:adjust' },
      { label: 'Add product or service', opens: 'item', permission: 'item:create' },
      { label: 'Add account', href: '/accounts', permission: 'account:create' },
    ],
  },
]

type DialogData =
  | {
      kind: 'customer' | 'vendor'
      terms: { id: string; label: string }[]
      expenseAccounts: AccountPickerOption[]
      today: string
      currency: string
    }
  | {
      kind: 'item'
      accounts: AccountOption[]
      today: string
      taxCodes: { id: string; label: string }[]
      categories: { id: string; label: string }[]
    }

/**
 * One button that starts anything.
 *
 * Every document in the system is two clicks from here, which is the point: the
 * alternative is remembering which module a refund receipt lives under before
 * you can begin one. Records that are dialogs open as dialogs, so adding a
 * customer does not throw away the page you were on.
 */
export function QuickCreate({
  permissions,
  currency,
  trigger = 'header',
}: {
  permissions: string[]
  currency: string
  /** `pill` is the full-width New button on the accounting list. */
  trigger?: 'header' | 'pill'
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [dialog, setDialog] = React.useState<DialogData | null>(null)
  const allowed = React.useMemo(() => new Set(permissions), [permissions])

  const columns = COLUMNS.map((column) => ({
    ...column,
    entries: column.entries.filter((entry) => !entry.permission || allowed.has(entry.permission)),
  })).filter((column) => column.entries.length > 0)

  async function choose(entry: Entry) {
    if ('href' in entry) {
      setOpen(false)
      startNavigationProgress()
      router.push(entry.href)
      return
    }

    setOpen(false)

    if (entry.opens === 'item') {
      const result = await itemDialogOptions(undefined)
      if (!result.ok) return toast.error(result.error.message)
      setDialog({ kind: 'item', ...result.data })
      return
    }

    const result = await contactDialogOptions(undefined)
    if (!result.ok) return toast.error(result.error.message)
    setDialog({ kind: entry.opens, ...result.data })
  }

  if (columns.length === 0) return null

  return (
    <>
      {trigger === 'pill' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <PlusIcon className="size-4" />
          New
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon />
          <span className="hidden sm:inline">Create</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Create</DialogTitle>
            <DialogDescription>Start a document, or add a record.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {column.heading}
                </p>
                <ul className="space-y-0.5">
                  {column.entries.map((entry) => (
                    <li key={entry.label}>
                      <button
                        type="button"
                        onClick={() => void choose(entry)}
                        className={cn(
                          'w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
                        )}
                      >
                        {entry.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
              onClose={() => setDialog(null)}
            />
          ) : (
            <ContactDialog
              side={dialog.kind}
              mode="create"
              terms={dialog.terms}
              expenseAccounts={dialog.expenseAccounts}
              today={dialog.today}
              currency={dialog.currency}
              onClose={() => setDialog(null)}
            />
          )}
        </React.Suspense>
      ) : null}
    </>
  )
}
