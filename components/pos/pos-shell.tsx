'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDownIcon, ShoppingBagIcon } from 'lucide-react'

import { ODOO } from '@/lib/odoo-brand'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  match?: (path: string) => boolean
  children?: { label: string; href: string }[]
}

const NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/pos',
    match: (path) => path === '/pos',
  },
  {
    label: 'Orders',
    href: '/pos/orders',
    children: [
      { label: 'Orders', href: '/pos/orders' },
      { label: 'Sessions', href: '/pos/sessions' },
      { label: 'Sales receipts', href: '/sales/sales-receipts' },
    ],
  },
  {
    label: 'Products',
    href: '/items',
    children: [
      { label: 'Products', href: '/items' },
      { label: 'Stock on hand', href: '/inventory/stock' },
    ],
  },
  {
    label: 'Reporting',
    href: '/pos/sessions',
    children: [
      { label: 'Sessions', href: '/pos/sessions' },
      { label: 'Sales receipts', href: '/sales/sales-receipts' },
      { label: 'Business overview', href: '/reports/business-overview' },
    ],
  },
  {
    label: 'Configuration',
    href: '/pos/settings',
    children: [
      { label: 'Settings', href: '/pos/settings' },
      { label: 'Payment methods', href: '/pos/settings#payment-methods' },
      { label: 'Registers', href: '/pos/settings#registers' },
      { label: 'Transfer to bank', href: '/banking/transfers/new' },
    ],
  },
]

export function PosShell({
  orgName,
  children,
}: {
  orgName: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hideChrome =
    pathname.includes('/lock') ||
    pathname.includes('/display') ||
    /^\/pos\/[^/]+$/.test(pathname)

  if (hideChrome) return <>{children}</>

  return (
    <div
      className="flex min-h-[calc(100svh-7.5rem)] flex-col"
      style={{ background: ODOO.ink, color: '#f5f5f5' }}
    >
      <header
        className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-2 sm:px-4"
        style={{ background: '#161618' }}
      >
        <Link
          href="/pos"
          className="mr-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-white"
        >
          <span
            className="inline-flex size-7 items-center justify-center rounded-md"
            style={{ background: ODOO.purple }}
          >
            <ShoppingBagIcon className="size-3.5" />
          </span>
          Point of Sale
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-0.5">
          {NAV.map((item) => (
            <PosNavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-white/70">
          <span
            className="inline-flex size-7 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: ODOO.danger }}
          >
            {(orgName.trim()[0] ?? 'P').toUpperCase()}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{orgName}</span>
        </div>
      </header>
      <div className="flex flex-1 flex-col px-3 py-5 sm:px-6">{children}</div>
    </div>
  )
}

function PosNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    item.match?.(pathname) ??
    (pathname === item.href || pathname.startsWith(`${item.href}/`))

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        className={cn(
          'rounded-md px-2.5 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white',
          active && 'bg-white/10 text-white',
        )}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white',
          active && 'bg-white/10 text-white',
        )}
      >
        {item.label}
        <ChevronDownIcon className="size-3.5 opacity-70" />
      </button>
      <div className="invisible absolute left-0 top-full z-30 min-w-[12rem] pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div
          className="rounded-md border border-white/10 py-1 shadow-xl"
          style={{ background: ODOO.surface }}
        >
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className="block px-3 py-1.5 text-sm text-white/85 hover:bg-white/10 hover:text-white"
            >
              {child.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
