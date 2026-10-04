'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MenuIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Item = {
  label: string
  href: string
  permission?: string
  /** Other paths that should light this row, when they are the closest match. */
  also?: string[]
}

/**
 * Every working screen, in the order an accountant walks the books.
 * Only routes that exist are listed.
 */
const ITEMS: Item[] = [
  { label: 'All sales', href: '/sales', permission: 'invoice:read' },
  { label: 'Invoices', href: '/sales/invoices', permission: 'invoice:read' },
  { label: 'Quotations', href: '/sales/estimates', permission: 'invoice:read' },
  { label: 'Sales receipts', href: '/sales/sales-receipts', permission: 'invoice:read' },
  { label: 'Credit memos', href: '/sales/credit-memos', permission: 'invoice:read' },
  { label: 'Payments', href: '/payments', permission: 'payment:read' },
  { label: 'Customers', href: '/customers', permission: 'customer:read' },
  { label: 'Overview', href: '/accounting', permission: 'account:read' },
  { label: 'Inventory', href: '/inventory', permission: 'item:read' },
  { label: 'Purchase orders', href: '/purchases/purchase-orders', permission: 'bill:read' },
  { label: 'Delivery', href: '/purchases/delivery', permission: 'bill:read' },
  {
    label: 'Standard reports',
    href: '/reports',
    permission: 'report:read',
    also: ['/sales/reports', '/purchases/reports', '/inventory/reports', '/accounting/reports'],
  },
  { label: 'Expenses', href: '/purchases/expenses', permission: 'expense:read' },
  { label: 'Bills', href: '/purchases/bills', permission: 'bill:read' },
  { label: 'Vendor credits', href: '/purchases/vendor-credits', permission: 'bill:read' },
  { label: 'Bill payments', href: '/bill-payments', permission: 'expense:read' },
  { label: 'Suppliers', href: '/vendors', permission: 'vendor:read' },
  { label: 'Products & services', href: '/items', permission: 'item:read' },
  { label: 'Bank transactions', href: '/banking', permission: 'bank:read' },
  { label: 'Chart of accounts', href: '/accounts', permission: 'account:read' },
  { label: 'Journal entries', href: '/journals', permission: 'journal:read' },
  { label: 'Periods', href: '/periods', permission: 'period:read' },
]

function visibleItems(permissions: string[]) {
  const allowed = new Set(permissions)
  return ITEMS.filter((item) => !item.permission || allowed.has(item.permission))
}

function activeHref(pathname: string, items: Item[]) {
  let best: { href: string; length: number } | undefined
  for (const item of items) {
    for (const prefix of [item.href, ...(item.also ?? [])]) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.length) best = { href: item.href, length: prefix.length }
      }
    }
  }
  return best?.href
}

export function AccountantNav({
  permissions,
  onNavigate,
}: {
  permissions: string[]
  currency: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = visibleItems(permissions)
  const current = activeHref(pathname, items)

  return (
    <nav aria-label="Accounting" className="flex items-center gap-1 overflow-x-auto px-3 py-1.5">
      {items.map((item) => {
        const selected = item.href === current
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors',
              selected ? 'bg-primary font-medium text-primary-foreground' : 'text-slate-600 hover:bg-primary/10 hover:text-primary',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** The same list, in a drawer, for a narrow screen. */
export function AccountantMenu({ permissions, currency }: { permissions: string[]; currency: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open accounting menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-svh max-h-svh w-64 translate-x-0 translate-y-0 rounded-none p-0 sm:left-0 sm:top-0 sm:max-h-svh sm:translate-x-0 sm:translate-y-0">
          <DialogTitle className="sr-only">Accounting</DialogTitle>
          <DialogDescription className="sr-only">Every part of the books.</DialogDescription>
          <AccountantNav permissions={permissions} currency={currency} onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
