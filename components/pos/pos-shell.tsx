'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDownIcon, ShoppingBagIcon } from 'lucide-react'

import { ODOO } from '@/lib/odoo-brand'
import type { Permission } from '@/lib/permissions-catalog'
import { cn } from '@/lib/utils'

type NavChild = {
  label: string
  href: string
  permission?: Permission
}

type NavItem = {
  label: string
  href: string
  match?: (path: string) => boolean
  children?: NavChild[]
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
      { label: 'Quotations', href: '/pos/quotations' },
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
      { label: 'Business overview', href: '/reports/business-overview', permission: 'report:overview' },
    ],
  },
  {
    label: 'Configuration',
    href: '/pos/settings',
    children: [
      { label: 'Settings', href: '/pos/settings' },
      { label: 'Payment methods', href: '/pos/settings#payment-methods' },
      { label: 'Counters', href: '/pos/settings#registers' },
      { label: 'Transfer to bank', href: '/banking/transfers/new' },
    ],
  },
]

/** Hub pages keep the POS chrome; only the live till (+ lock/display) hide it. */
const POS_HUB_SEGMENTS = new Set(['orders', 'quotations', 'sessions', 'settings'])

function isPosTillRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  return (
    segments.length === 2 &&
    segments[0] === 'pos' &&
    !POS_HUB_SEGMENTS.has(segments[1]!)
  )
}

/** Reporting links the caller may open. Business overview is not part of the till. */
export function visiblePosNav(permissions: Iterable<string>): NavItem[] {
  const allowed = new Set(permissions)
  return NAV.map((item) => {
    if (!item.children) return item
    return {
      ...item,
      children: item.children.filter((child) => !child.permission || allowed.has(child.permission)),
    }
  })
}

export function PosShell({
  orgName,
  permissions,
  children,
}: {
  orgName: string
  permissions: readonly string[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const nav = visiblePosNav(permissions)
  const hideChrome =
    pathname.includes('/lock') ||
    pathname.includes('/display') ||
    isPosTillRoute(pathname)

  if (hideChrome) return <>{children}</>

  return (
    <div className="flex min-h-[calc(100svh-7.5rem)] flex-col text-foreground">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-border bg-card px-3 py-2 sm:px-4">
        <Link
          href="/pos"
          className="mr-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-foreground"
        >
          <span
            className="inline-flex size-7 items-center justify-center rounded-md text-white"
            style={{ background: ODOO.purple }}
          >
            <ShoppingBagIcon className="size-3.5" />
          </span>
          Point of Sale
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-0.5">
          {nav.map((item) => (
            <PosNavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {pathname !== '/pos' ? (
            <Link
              href="/pos"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              ← Dashboard
            </Link>
          ) : null}
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
          'rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground',
          active && 'bg-accent text-foreground',
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
          'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground',
          active && 'bg-accent text-foreground',
        )}
      >
        {item.label}
        <ChevronDownIcon className="size-3.5 opacity-70" />
      </button>
      <div className="invisible absolute left-0 top-full z-30 min-w-[12rem] pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className="block px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              {child.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
