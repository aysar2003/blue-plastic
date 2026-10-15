'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDownIcon, MoreHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'

import { deleteCustomer, setCustomersActive } from '@/app/(app)/customers/actions'
import { ContactDialog, type ContactValues, type Option } from '@/components/master-data/contact-dialog'
import {
  MergeIntoDialog,
  type MergeOption,
} from '@/components/master-data/merge-into-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { customerContactMenu, customerQuickReportHref } from '@/lib/contact-menus'
import { cn } from '@/lib/utils'

/** Theme-aware primary action (Odoo plum when Odoo theme is on). */
const ACTION = 'bg-primary text-primary-foreground hover:bg-primary/90'
const LINK = 'text-primary hover:underline'

/**
 * Create sales from here with this customer chosen — plus QuickReport, edit,
 * and make active / inactive.
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
  canDelete = false,
  isActive,
  layout = 'menu',
  mergeOptions = [],
  startEditing = false,
  clearEditHref,
  portalInvite = false,
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
  /** Hard-delete when unused; otherwise use Merge. */
  canDelete?: boolean
  isActive: boolean
  layout?: 'menu' | 'panel' | 'row'
  mergeOptions?: MergeOption[]
  /** Open the edit dialog on mount (left-list … → Edit). */
  startEditing?: boolean
  /** Drop `edit=` from the URL when the dialog closes. */
  clearEditHref?: string
  portalInvite?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(startEditing && Boolean(contact))
  const [merging, setMerging] = useState(false)

  // Reopen the edit dialog when a new "edit" request arrives (adjusting state
  // during render instead of in an effect avoids a cascading re-render).
  const editRequest = startEditing && contact ? customerId : null
  const [seenEditRequest, setSeenEditRequest] = useState(editRequest)
  if (editRequest !== seenEditRequest) {
    setSeenEditRequest(editRequest)
    if (editRequest) setEditing(true)
  }

  const closeEdit = () => {
    setEditing(false)
    if (clearEditHref) router.replace(clearEditHref)
  }
  const [isPending, startTransition] = useTransition()
  const links = useMemo(
    () => customerContactMenu(customerId, { canInvoice, canPay, canReport }),
    [customerId, canInvoice, canPay, canReport],
  )
  const primary = links.find((action) => action.label === 'Create invoice') ?? links[0]
  const rest = links.filter((action) => action !== primary)

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

  const showDelete = canDelete
  const showMerge = canDelete

  const remove = () => {
    if (
      !window.confirm(
        'Delete this customer? Only works when they have no transactions. Otherwise merge them into another customer.',
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteCustomer({ id: customerId })
      if (result.ok) {
        toast.success('Customer deleted.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  const editArchiveItems = (
    <>
      {(canEdit || canArchive || showDelete || showMerge) && rest.length > 0 ? (
        <DropdownMenuSeparator />
      ) : null}
      {canEdit && contact ? (
        <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
      ) : null}
      {canArchive ? (
        <DropdownMenuItem variant={isActive ? 'destructive' : 'default'} onSelect={archive}>
          {isActive ? 'Make inactive' : 'Make active'}
        </DropdownMenuItem>
      ) : null}
      {showMerge ? (
        <DropdownMenuItem onSelect={() => setMerging(true)}>Merge into…</DropdownMenuItem>
      ) : null}
      {showDelete ? (
        <DropdownMenuItem variant="destructive" onSelect={remove}>
          Delete
        </DropdownMenuItem>
      ) : null}
    </>
  )

  return (
    <>
      {layout === 'panel' ? (
        <div className="flex flex-col gap-2">
          {primary ? (
            <Link href={primary.href} className={cn(buttonVariants({ size: 'sm' }), ACTION, 'w-full')}>
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
          {(canEdit || canArchive || showDelete) && (primary || rest.length > 0) ? (
            <div className="my-1 h-px bg-border" />
          ) : null}
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
          {showDelete ? (
            <Button variant="destructive" size="sm" disabled={isPending} onClick={remove}>
              Delete
            </Button>
          ) : null}
        </div>
      ) : layout === 'row' && primary ? (
        <div className="inline-flex items-center gap-1">
          <Link href={primary.href} className={cn('text-sm font-medium', LINK)}>
            {primary.label}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="text-primary" aria-label="More actions for this customer">
              <ChevronDownIcon className="size-4" />
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
      ) : primary || canEdit || canArchive || showDelete ? (
        <div className="inline-flex flex-wrap items-center gap-1.5">
          {canReport ? (
            <Link
              href={customerQuickReportHref(customerId)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              QuickReport
            </Link>
          ) : null}
          {primary ? (
            <div className="inline-flex">
              <Link href={primary.href} className={cn(buttonVariants({ size: 'sm' }), ACTION, 'rounded-r-none')}>
                {primary.label}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className={cn(ACTION, 'rounded-l-none border-l border-white/25 px-1.5')}
                    aria-label="More actions for this customer"
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
                <Button variant="outline" size="sm" aria-label="More actions for this customer">
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

      {merging ? (
        <MergeIntoDialog
          open={merging}
          onClose={() => setMerging(false)}
          kind="customer"
          absorbId={customerId}
          absorbLabel={contact?.displayName ?? 'Customer'}
          options={mergeOptions}
        />
      ) : null}

      {editing && contact ? (
        <ContactDialog
          side="customer"
          mode="edit"
          contact={{ ...contact, id: customerId }}
          terms={terms}
          today={today}
          currency={currency}
          portalInvite={portalInvite}
          onClose={closeEdit}
        />
      ) : null}
    </>
  )
}
