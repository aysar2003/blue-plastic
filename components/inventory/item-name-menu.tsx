'use client'

import Link from 'next/link'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The three things QuickBooks offers the moment a product is opened:
 * change it, read its transactions, or count it.
 */
export function ItemNameMenu({
  id,
  name,
  tracked,
  canEdit,
  canAdjust,
  onEdit,
}: {
  id: string
  name: string
  tracked: boolean
  canEdit: boolean
  canAdjust: boolean
  /** Opens the editor here. Without it, Edit goes to the products list. */
  onEdit?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="text-left font-medium underline-offset-4 hover:underline">
          {name}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {canEdit ? (
          onEdit ? (
            <DropdownMenuItem onSelect={() => onEdit()}>Edit</DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={`/items?edit=${id}`}>Edit</Link>
            </DropdownMenuItem>
          )
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/items/${id}/report`}>Quick report</Link>
        </DropdownMenuItem>
        {tracked && canAdjust ? (
          <DropdownMenuItem asChild>
            <Link href={`/inventory/adjustments/new?item=${id}`}>Adjustment</Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
