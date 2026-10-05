'use client'

import Link from 'next/link'
import { ChevronDownIcon, PlusIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const LINKS = [
  { href: '/purchases/bills/new', label: 'Bill', permission: 'bill' },
  { href: '/purchases/expenses/new', label: 'Expense', permission: 'expense' },
  { href: '/purchases/purchase-orders/new', label: 'Purchase order', permission: 'bill' },
  { href: '/purchases/vendor-credits/new', label: 'Supplier credit', permission: 'bill' },
  { href: '/bill-payments/new', label: 'Bill payment', permission: 'expense' },
] as const

export function NewTransactionMenu({ canBill, canExpense }: { canBill: boolean; canExpense: boolean }) {
  const links = LINKS.filter((link) => (link.permission === 'bill' ? canBill : canExpense))
  if (links.length === 0) return null
  if (links.length === 1) {
    const only = links[0]
    if (!only) return null
    return (
      <Link href={only.href} className={buttonVariants({ size: 'sm' })}>
        <PlusIcon /> {only.label}
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ size: 'sm' })}>
        New transaction
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {links.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href}>{link.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
