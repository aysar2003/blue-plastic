'use client'

import Link from 'next/link'
import { MoreHorizontalIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The same doors an item opens elsewhere — edit, quick report, movements,
 * adjustment — plus transfer to another store from this store's shelf.
 */
export function StoreItemMenu({
  itemId,
  itemName,
  storeId,
  canEdit,
  canAdjust,
}: {
  itemId: string
  itemName: string
  storeId: string
  canEdit: boolean
  canAdjust: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${itemName}`}
          className="print:hidden"
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <DropdownMenuItem asChild>
            <Link href={`/items?edit=${itemId}`}>Edit item</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/items/${itemId}/report`}>Quick report</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/inventory/${itemId}`}>Item movements</Link>
        </DropdownMenuItem>
        {canAdjust ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/inventory/adjustments/new?item=${itemId}`}>Adjustment</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/stores/tickets/new?from=${storeId}&item=${itemId}`}>
                New store ticket
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/stores/transfer/new?from=${storeId}&item=${itemId}`}>
                Transfer to store
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
