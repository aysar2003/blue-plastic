'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  ItemDialog,
  type AccountOption,
  type ItemValues,
  type SimpleOption,
} from '@/components/master-data/item-dialog'
import { DeleteMenuItem } from '@/components/data/delete-record'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { ItemNameMenu } from '@/components/inventory/item-name-menu'
import { QtyCell } from '@/components/inventory/line-store'
import { setItemsActive } from './actions'

export type ItemRow = ItemValues & {
  id: string
  name: string
  type: 'SERVICE' | 'NON_INVENTORY' | 'INVENTORY'
  isActive: boolean
  incomeAccount: { code: string; name: string } | null
  expenseAccount: { code: string; name: string } | null
  inventoryAccount: { code: string; name: string } | null
  cogsAccount: { code: string; name: string } | null
  store: { id: string; name: string } | null
  category: { name: string } | null
  /** Stock, for tracked items. Null for services and non-inventory goods. */
  onHand?: string | null
  /** Quantity in each store. The columns add up to on hand. */
  storeQty?: Record<string, string>
  stockValue?: string | null
  averageCost?: string | null
  belowReorder?: boolean
  recorded?: string | null
}

function accountText(account: { code: string; name: string } | null) {
  return account ? `${account.code} ${account.name}` : '—'
}

const TYPE_LABEL = {
  SERVICE: 'Service',
  NON_INVENTORY: 'Non-inventory',
  INVENTORY: 'Inventory',
} as const

export function ItemTable({
  rows,
  accounts,
  taxCodes,
  categories,
  stores = [],
  storeColumns = [],
  currency,
  canEdit,
  canArchive,
  canAdjust,
  sort,
  linkParams,
  startEditingId,
  extraEdit,
}: {
  rows: ItemRow[]
  accounts: AccountOption[]
  taxCodes: SimpleOption[]
  categories: SimpleOption[]
  stores?: SimpleOption[]
  /** One calculated column per store. Existing columns stay as they are. */
  storeColumns?: { id: string; name: string }[]
  currency: string
  canEdit: boolean
  canArchive: boolean
  canAdjust: boolean
  startEditingId?: string
  /** Used when Edit is opened for an item that is not on this page of the list. */
  extraEdit?: ItemRow | null
  /** Sorting is server-side, over every row — see SortableHeader. */
  sort: SortState
  linkParams: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ItemRow | null>(
    () => rows.find((row) => row.id === startEditingId) ?? extraEdit ?? null,
  )
  const [isPending, startTransition] = useTransition()

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id))

  const single = (id: string, isActive: boolean) =>
    startTransition(async () => {
      const result = await setItemsActive({ ids: [id], isActive })
      if (result.ok) {
        toast.success(isActive ? 'Restored.' : 'Archived.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })

  const bulk = (isActive: boolean) =>
    startTransition(async () => {
      const result = await setItemsActive({ ids: [...selected], isActive })
      if (result.ok) {
        toast.success(`${result.data.count} ${isActive ? 'restored' : 'archived'}.`)
        setSelected(new Set())
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })

  return (
    <>
      {selected.size > 0 && canArchive ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="tabular font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => bulk(false)}>
              {isPending ? <Loader2Icon className="animate-spin" /> : <ArchiveIcon />} Archive
            </Button>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => bulk(true)}>
              <ArchiveRestoreIcon /> Restore
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="bg-[#d5dde6] hover:bg-[#d5dde6]">
            {canArchive ? (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-4 rounded border-input"
                />
              </TableHead>
            ) : null}
            <SortableHeader column="name" label="Item" state={sort} basePath="/items" params={linkParams} />
            <SortableHeader column="type" label="Type" state={sort} basePath="/items" params={linkParams} className="w-32" />
            <TableHead>Income account</TableHead>
            <TableHead>Inventory account</TableHead>
            <TableHead>COGS or expense</TableHead>
            <TableHead>Store</TableHead>
            <TableHead className="numeric w-28">On hand</TableHead>
            {storeColumns.map((store) => (
              <TableHead key={store.id} className="numeric w-28">
                {store.name}
              </TableHead>
            ))}
            <SortableHeader column="price" label="Price" state={sort} basePath="/items" params={linkParams} className="w-28" numeric defaultDirection="desc" />
            <TableHead className="numeric w-28">Stock value</TableHead>
            <SortableHeader column="cost" label="Cost" state={sort} basePath="/items" params={linkParams} className="w-28" numeric defaultDirection="desc" />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={`${index % 2 === 1 ? 'bg-[#c5dff3] hover:bg-[#c5dff3]' : 'bg-white hover:bg-white'} ${
                row.isActive ? '' : 'opacity-55'
              }`}
            >
              {canArchive ? (
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name}`}
                    checked={selected.has(row.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (next.has(row.id)) next.delete(row.id)
                        else next.add(row.id)
                        return next
                      })
                    }
                    className="size-4 rounded border-input"
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <ItemNameMenu
                  id={row.id}
                  name={row.name}
                  tracked={row.type === 'INVENTORY'}
                  canEdit={canEdit}
                  canAdjust={canAdjust}
                  onEdit={canEdit ? () => setEditing(row) : undefined}
                />
                <span className="block text-xs text-muted-foreground">
                  {row.sku ? `${row.sku} · ` : ''}
                  {row.category?.name ?? 'Uncategorised'}
                </span>
                {!row.isActive ? (
                  <Badge variant="outline" className="mt-1">
                    archived
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge variant={row.type === 'INVENTORY' ? 'default' : 'secondary'}>
                  {TYPE_LABEL[row.type]}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {accountText(row.incomeAccount)}
              </TableCell>
              <TableCell className="text-xs">
                {row.type === 'INVENTORY' ? accountText(row.inventoryAccount) : '—'}
              </TableCell>
              <TableCell className="text-xs">
                {row.type === 'INVENTORY' ? accountText(row.cogsAccount) : accountText(row.expenseAccount)}
              </TableCell>
              <TableCell className="text-xs">
                {row.store ? (
                  <Link href={`/stores/${row.store.id}`} className="underline-offset-4 hover:underline">
                    {row.store.name}
                  </Link>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="numeric tabular">
                {row.type === 'INVENTORY' ? (
                  <>
                    <Link
                      href={`/inventory/${row.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.onHand ?? '0.00'}
                    </Link>
                    {row.belowReorder ? (
                      <Badge variant="warning" className="ml-1.5">
                        reorder
                      </Badge>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {storeColumns.map((store) => (
                <TableCell key={store.id} className="numeric">
                  <QtyCell
                    tracked={row.type === 'INVENTORY'}
                    quantity={row.storeQty?.[store.id] ?? '0.00'}
                  />
                </TableCell>
              ))}
              <TableCell className="numeric tabular">
                {row.salesPrice ? formatMoney(row.salesPrice, currency) : '—'}
              </TableCell>
              <TableCell className="numeric tabular text-muted-foreground">
                {row.type === 'INVENTORY' && row.stockValue
                  ? formatMoney(row.stockValue, currency)
                  : '—'}
              </TableCell>
              <TableCell className="numeric tabular font-medium">
                {row.type === 'INVENTORY'
                  ? row.averageCost && Number(row.averageCost) !== 0
                    ? formatMoney(row.averageCost, currency)
                    : row.purchaseCost
                      ? formatMoney(row.purchaseCost, currency)
                      : '—'
                  : row.purchaseCost
                    ? formatMoney(row.purchaseCost, currency)
                    : '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${row.name}`}
                      onClick={() => setEditing(row)}
                    >
                      <PencilIcon />
                    </Button>
                  ) : null}
                  {canArchive ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit ? (
                          <DropdownMenuItem onSelect={() => setEditing(row)}>
                            <PencilIcon className="size-4" /> Edit
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem asChild>
                          <Link href={`/items/${row.id}/report`}>Quick report</Link>
                        </DropdownMenuItem>
                        {row.type === 'INVENTORY' && canAdjust ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/adjustments/new?item=${row.id}`}>Adjustment</Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            single(row.id, !row.isActive)
                          }}
                        >
                          {row.isActive ? (
                            <ArchiveIcon className="size-4" />
                          ) : (
                            <ArchiveRestoreIcon className="size-4" />
                          )}
                          {row.isActive ? 'Archive' : 'Restore'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DeleteMenuItem kind="item" id={row.id} number={row.name} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing ? (
        <ItemDialog
          mode="edit"
          item={editing}
          accounts={accounts}
          taxCodes={taxCodes}
          categories={categories}
          stores={stores}
          currency={currency}
          recorded={editing.recorded}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}
