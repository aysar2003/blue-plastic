'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDownIcon, MoreHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'

import { setVendorsActive } from '@/app/(app)/customers/actions'
import { ContactDialog, type ContactValues, type Option } from '@/components/master-data/contact-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AccountPickerOption } from '@/lib/account-options'
import { vendorContactMenu, vendorQuickReportHref } from '@/lib/contact-menus'
import { cn } from '@/lib/utils'

const TEAL = 'bg-[#2ca01c] text-white hover:bg-[#248a18]'

/**
 * Bills, receiving, pay, QuickReport, edit, and make active / inactive for one vendor.
 */
export function VendorActions({
  vendorId,
  contact,
  terms,
  expenseAccounts,
  today,
  currency,
  canBill,
  canPay,
  canReport,
  canEdit,
  canArchive,
  isActive,
  layout = 'menu',
}: {
  vendorId: string
  contact?: ContactValues
  terms: Option[]
  expenseAccounts?: AccountPickerOption[]
  today: string
  currency: string
  canBill: boolean
  canPay: boolean
  canReport: boolean
  canEdit: boolean
  canArchive: boolean
  isActive: boolean
  layout?: 'menu' | 'panel'
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const links = useMemo(
    () => vendorContactMenu(vendorId, { canBill, canPay, canReport }),
    [vendorId, canBill, canPay, canReport],
  )
  const primary = links.find((action) => action.label === 'Enter bills') ?? links[0]
  const rest = links.filter((action) => action !== primary)

  const archive = () => {
    startTransition(async () => {
      const result = await setVendorsActive({ ids: [vendorId], isActive: !isActive })
      if (result.ok) {
        toast.success(isActive ? 'Vendor made inactive.' : 'Vendor made active.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  const editArchiveItems = (
    <>
      {(canEdit || canArchive) && rest.length > 0 ? <DropdownMenuSeparator /> : null}
      {canEdit && contact ? (
        <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
      ) : null}
      {canArchive ? (
        <DropdownMenuItem variant={isActive ? 'destructive' : 'default'} onSelect={archive}>
          {isActive ? 'Make inactive' : 'Make active'}
        </DropdownMenuItem>
      ) : null}
    </>
  )

  return (
    <>
      {layout === 'panel' ? (
        <div className="flex flex-col gap-2">
          {primary ? (
            <Link href={primary.href} className={cn(buttonVariants({ size: 'sm' }), TEAL, 'w-full')}>
              {primary.label}
            </Link>
          ) : null}
          {rest.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
            >
              {action.label}
            </Link>
          ))}
          {(canEdit || canArchive) && (primary || rest.length > 0) ? <div className="my-1 h-px bg-border" /> : null}
          {canEdit && contact ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {canArchive ? (
            <Button variant={isActive ? 'destructive' : 'outline'} size="sm" disabled={isPending} onClick={archive}>
              {isActive ? 'Make inactive' : 'Make active'}
            </Button>
          ) : null}
        </div>
      ) : primary || canEdit || canArchive ? (
        <div className="inline-flex flex-wrap items-center gap-1.5">
          {canReport ? (
            <Link
              href={vendorQuickReportHref(vendorId)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              QuickReport
            </Link>
          ) : null}
          {primary ? (
            <div className="inline-flex">
              <Link href={primary.href} className={cn(buttonVariants({ size: 'sm' }), TEAL, 'rounded-r-none')}>
                {primary.label}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className={cn(TEAL, 'rounded-l-none border-l border-white/25 px-1.5')}
                    aria-label="More actions for this vendor"
                  >
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {rest.map((action) => (
                    <DropdownMenuItem key={action.href} asChild>
                      <Link href={action.href}>{action.label}</Link>
                    </DropdownMenuItem>
                  ))}
                  {editArchiveItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions for this vendor">
                  <MoreHorizontalIcon />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {links.map((action) => (
                  <DropdownMenuItem key={action.href} asChild>
                    <Link href={action.href}>{action.label}</Link>
                  </DropdownMenuItem>
                ))}
                {editArchiveItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && contact ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
        </div>
      ) : null}

      {editing && contact ? (
        <ContactDialog
          side="vendor"
          mode="edit"
          contact={{ ...contact, id: vendorId }}
          terms={terms}
          expenseAccounts={expenseAccounts}
          today={today}
          currency={currency}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}
