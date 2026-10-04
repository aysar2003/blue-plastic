'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDownIcon } from 'lucide-react'
import { toast } from 'sonner'

import { setCustomersActive } from '@/app/(app)/customers/actions'
import { ContactDialog, type ContactValues, type Option } from '@/components/master-data/contact-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const TEAL = 'bg-[#2ca01c] text-white hover:bg-[#248a18]'

type Action = { label: string; href: string }

function salesActions(customerId: string, canInvoice: boolean, canPay: boolean, canReport: boolean): Action[] {
  const id = encodeURIComponent(customerId)
  const actions: Action[] = []
  if (canInvoice) {
    actions.push(
      { label: 'Create invoice', href: `/sales/invoices/new?customer=${id}` },
      { label: 'Create quotation', href: `/sales/estimates/new?customer=${id}` },
      { label: 'Create sales receipt', href: `/sales/sales-receipts/new?customer=${id}` },
      { label: 'Create credit memo', href: `/sales/credit-memos/new?customer=${id}` },
      { label: 'Create refund', href: `/sales/refunds/new?customer=${id}` },
    )
  }
  if (canPay) actions.push({ label: 'Receive payment', href: `/payments/new?customer=${id}` })
  if (canReport) {
    actions.push({ label: 'Statement', href: `/reports/statements/customer?customerId=${id}` })
  }
  return actions
}

/**
 * The right-hand action on a customer: create the sale from here, with this
 * customer already chosen. The list uses the split button from the QuickBooks
 * customers page. The customer page uses the same links as a panel.
 */
export function CustomerActions({
  customerId,
  contact,
  terms,
  today,
  currency,
  canInvoice,
  canPay,
  canReport,
  canEdit,
  canArchive,
  isActive,
  layout = 'menu',
}: {
  customerId: string
  contact?: ContactValues
  terms: Option[]
  today: string
  currency: string
  canInvoice: boolean
  canPay: boolean
  canReport: boolean
  canEdit: boolean
  canArchive: boolean
  isActive: boolean
  layout?: 'menu' | 'panel' | 'row'
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const actions = salesActions(customerId, canInvoice, canPay, canReport)
  const primary = actions.find((action) => action.label === 'Create invoice') ?? actions[0]
  const rest = actions.filter((action) => action !== primary)

  const archive = () => {
    startTransition(async () => {
      const result = await setCustomersActive({ ids: [customerId], isActive: !isActive })
      if (result.ok) {
        toast.success(isActive ? 'Customer made inactive.' : 'Customer made active.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  const editAndArchive = (
    <>
      {canEdit && contact ? (
        <button type="button" className={panelItem} onClick={() => setEditing(true)}>
          Edit
        </button>
      ) : null}
      {canArchive ? (
        <button type="button" className={cn(panelItem, isActive && 'text-destructive')} onClick={archive} disabled={isPending}>
          {isActive ? 'Make inactive' : 'Make active'}
        </button>
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
            <Link key={action.href} href={action.href} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}>
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
      ) : layout === 'row' && primary ? (
        <div className="inline-flex items-center gap-1">
          <Link href={primary.href} className="text-sm font-medium text-[#2ca01c] hover:underline">
            {primary.label}
          </Link>
          {rest.length > 0 || canEdit || canArchive ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="text-[#2ca01c]" aria-label="More actions for this customer">
                <ChevronDownIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {rest.map((action) => (
                  <DropdownMenuItem key={action.href} asChild>
                    <Link href={action.href}>{action.label}</Link>
                  </DropdownMenuItem>
                ))}
                {(canEdit || canArchive) && rest.length > 0 ? <DropdownMenuSeparator /> : null}
                {canEdit && contact ? (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
                ) : null}
                {canArchive ? (
                  <DropdownMenuItem variant={isActive ? 'destructive' : 'default'} onSelect={archive}>
                    {isActive ? 'Make inactive' : 'Make active'}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : primary ? (
        <div className="inline-flex">
          <Link href={primary.href} className={cn(buttonVariants({ size: 'sm' }), TEAL, 'rounded-r-none')}>
            {primary.label}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className={cn(TEAL, 'rounded-l-none border-l border-white/25 px-1.5')} aria-label={`More actions for this customer`}>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {rest.map((action) => (
                <DropdownMenuItem key={action.href} asChild>
                  <Link href={action.href}>{action.label}</Link>
                </DropdownMenuItem>
              ))}
              {(canEdit || canArchive) && rest.length > 0 ? <DropdownMenuSeparator /> : null}
              {canEdit && contact ? (
                <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
              ) : null}
              {canArchive ? (
                <DropdownMenuItem variant={isActive ? 'destructive' : 'default'} onSelect={archive}>
                  {isActive ? 'Make inactive' : 'Make active'}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-1">{editAndArchive}</div>
      )}

      {editing && contact ? (
        <ContactDialog
          side="customer"
          mode="edit"
          contact={{ ...contact, id: customerId }}
          terms={terms}
          today={today}
          currency={currency}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}

const panelItem =
  'rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50'
