'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontalIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export type ContactMenuItem =
  | { type: 'link'; label: string; href: string }
  | { type: 'action'; label: string; onSelect: () => void; destructive?: boolean }
  | { type: 'separator' }

/**
 * One name on the customers / vendors list: click to open, double-click for
 * QuickReport, and … for every related transaction.
 */
export function ContactPersonRow({
  href,
  selected,
  name,
  balance,
  currency,
  active,
  doubleClickHref,
  menu,
}: {
  href: string
  selected: boolean
  name: string
  balance: string
  currency: string
  active: boolean
  doubleClickHref?: string
  menu: ContactMenuItem[]
}) {
  const router = useRouter()

  return (
    <div
      className={cn(
        'group grid h-[2.2rem] grid-cols-[minmax(0,1fr)_5.5rem_1.75rem] items-center px-1 text-sm',
        selected
          ? 'bg-primary/25 font-medium text-foreground'
          : 'text-foreground hover:bg-accent',
        !active && 'opacity-55',
      )}
    >
      <Link
        href={href}
        aria-current={selected ? 'true' : undefined}
        title={doubleClickHref ? 'Double-click for QuickReport' : undefined}
        className="flex h-full min-w-0 items-center truncate px-1 uppercase"
        onDoubleClick={(event) => {
          if (!doubleClickHref) return
          event.preventDefault()
          router.push(doubleClickHref)
        }}
      >
        {name}
      </Link>
      <Link
        href={href}
        tabIndex={-1}
        className="tabular flex h-full items-center justify-end px-1 text-right text-xs"
        onDoubleClick={(event) => {
          if (!doubleClickHref) return
          event.preventDefault()
          router.push(doubleClickHref)
        }}
      >
        {formatMoney(balance, currency)}
      </Link>
      <div className="flex justify-end">
        {menu.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 opacity-70 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Actions for ${name}`}
                onClick={(event) => event.preventDefault()}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {menu.map((item, index) => {
                if (item.type === 'separator') {
                  return <DropdownMenuSeparator key={`sep-${index}`} />
                }
                if (item.type === 'link') {
                  return (
                    <DropdownMenuItem key={`${item.label}-${item.href}`} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  )
                }
                return (
                  <DropdownMenuItem
                    key={item.label}
                    variant={item.destructive ? 'destructive' : 'default'}
                    onSelect={item.onSelect}
                  >
                    {item.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}

/** Shared … trigger used in the information header. */
export function ContactOverflowMenu({
  label,
  menu,
  children,
}: {
  label: string
  menu: ContactMenuItem[]
  children?: ReactNode
}) {
  if (menu.length === 0 && !children) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={label}>
          <MoreHorizontalIcon />
          More
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
        {menu.map((item, index) => {
          if (item.type === 'separator') {
            return <DropdownMenuSeparator key={`sep-${index}`} />
          }
          if (item.type === 'link') {
            return (
              <DropdownMenuItem key={`${item.label}-${item.href}`} asChild>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            )
          }
          return (
            <DropdownMenuItem
              key={item.label}
              variant={item.destructive ? 'destructive' : 'default'}
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
