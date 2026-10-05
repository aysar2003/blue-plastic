'use client'

import { useState, useTransition, useMemo } from 'react'
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
import { ClickableRow } from '@/components/data/clickable-row'
import { DeleteMenuItem } from '@/components/data/delete-record'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { TableColumnCustomize } from '@/components/data/table-column-customize'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { cn } from '@/lib/utils'
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
import {
  buildItemTableColumns,
  ITEM_DEFAULT_HIDDEN,
  ITEM_TABLE_STORAGE_KEY,
  isStoreColumnId,
  type ItemColumnDef,
} from '@/lib/item-table-columns'
import { useTableColumnPrefs } from '@/lib/use-table-column-prefs'
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

  const catalog = useMemo(() => buildItemTableColumns(storeColumns), [storeColumns])
  const { prefs, visible, toggle, reorder } = useTableColumnPrefs(
    ITEM_TABLE_STORAGE_KEY,
    catalog,
    ITEM_DEFAULT_HIDDEN,
  )
  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible])

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

  function renderHeader(col: ItemColumnDef) {
    switch (col.id) {
      case 'name':
        return (
          <SortableHeader
            key={col.id}
            column="name"
            label={col.label}
            state={sort}
            basePath="/items"
            params={linkParams}
          />
        )
      case 'type':
        return (
          <SortableHeader
            key={col.id}
            column="type"
            label={col.label}
            state={sort}
            basePath="/items"
            params={linkParams}
            className="w-32"
          />
        )
      case 'price':
        return (
          <SortableHeader
            key={col.id}
            column="price"
            label={col.label}
            state={sort}
            basePath="/items"
            params={linkParams}
            className="w-28"
            numeric
            defaultDirection="desc"
          />
        )
      case 'cost':
        return (
          <SortableHeader
            key={col.id}
            column="cost"
            label={col.label}
            state={sort}
            basePath="/items"
            params={linkParams}
            className="w-28"
            numeric
            defaultDirection="desc"
          />
        )
      case 'onHand':
      case 'stockValue':
        return (
          <TableHead key={col.id} className="numeric w-28 bg-[var(--band)]">
            {col.label}
          </TableHead>
        )
      default:
        return (
          <TableHead
            key={col.id}
            className={cn(
              'bg-[var(--band)]',
              isStoreColumnId(col.id) && 'numeric w-28',
              (col.id === 'sku' || col.id === 'category') && 'w-32',
            )}
          >
            {col.label}
          </TableHead>
        )
    }
  }

  function renderCell(row: ItemRow, col: ItemColumnDef) {
    switch (col.id) {
      case 'name':
        return (
          <TableCell key={col.id}>
            <ItemNameMenu
              id={row.id}
              name={row.name}
              tracked={row.type === 'INVENTORY'}
              canEdit={canEdit}
              canAdjust={canAdjust}
              onEdit={canEdit ? () => setEditing(row) : undefined}
            />
            {!visibleIds.has('sku') || !visibleIds.has('category') ? (
              <span className="block text-xs text-muted-foreground">
                {!visibleIds.has('sku') && row.sku ? `${row.sku} · ` : ''}
                {!visibleIds.has('category') ? (row.category?.name ?? 'Uncategorised') : ''}
              </span>
            ) : null}
            {!row.isActive ? (
              <Badge variant="outline" className="mt-1">
                archived
              </Badge>
            ) : null}
          </TableCell>
        )
      case 'sku':
        return (
          <TableCell key={col.id} className="text-sm tabular">
            {row.sku ?? '—'}
          </TableCell>
        )
      case 'category':
        return (
          <TableCell key={col.id} className="text-sm">
            {row.category?.name ?? 'Uncategorised'}
          </TableCell>
        )
      case 'salesDescription':
        return (
          <TableCell key={col.id} className="max-w-xs truncate text-sm text-muted-foreground">
            {row.salesDescription ?? '—'}
          </TableCell>
        )
      case 'purchaseDescription':
        return (
          <TableCell key={col.id} className="max-w-xs truncate text-sm text-muted-foreground">
            {row.purchaseDescription ?? '—'}
          </TableCell>
        )
      case 'type':
        return (
          <TableCell key={col.id}>
            <Badge variant={row.type === 'INVENTORY' ? 'default' : 'secondary'}>
              {TYPE_LABEL[row.type]}
            </Badge>
          </TableCell>
        )
      case 'incomeAccount':
        return (
          <TableCell key={col.id} className="text-xs">
            {accountText(row.incomeAccount)}
          </TableCell>
        )
      case 'inventoryAccount':
        return (
          <TableCell key={col.id} className="text-xs">
            {row.type === 'INVENTORY' ? accountText(row.inventoryAccount) : '—'}
          </TableCell>
        )
      case 'cogsExpense':
        return (
          <TableCell key={col.id} className="text-xs">
            {row.type === 'INVENTORY' ? accountText(row.cogsAccount) : accountText(row.expenseAccount)}
          </TableCell>
        )
      case 'store':
        return (
          <TableCell key={col.id} className="text-xs">
            {row.store ? (
              <Link href={`/stores/${row.store.id}`} className="underline-offset-4 hover:underline">
                {row.store.name}
              </Link>
            ) : (
              '—'
            )}
          </TableCell>
        )
      case 'onHand':
        return (
          <TableCell key={col.id} className="numeric tabular">
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
        )
      case 'price':
        return (
          <TableCell key={col.id} className="numeric tabular">
            {row.salesPrice ? formatMoney(row.salesPrice, currency) : '—'}
          </TableCell>
        )
      case 'stockValue':
        return (
          <TableCell key={col.id} className="numeric tabular text-muted-foreground">
            {row.type === 'INVENTORY' && row.stockValue ? formatMoney(row.stockValue, currency) : '—'}
          </TableCell>
        )
      case 'cost':
        return (
          <TableCell key={col.id} className="numeric tabular font-medium">
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
        )
      case 'reorderPoint':
        return (
          <TableCell key={col.id} className="numeric tabular text-sm">
            {row.type === 'INVENTORY' && row.reorderPoint ? row.reorderPoint : '—'}
          </TableCell>
        )
      case 'unitOfMeasure':
        return (
          <TableCell key={col.id} className="text-sm">
            {row.unitOfMeasure ?? '—'}
          </TableCell>
        )
      default: {
        if (!isStoreColumnId(col.id)) return null
        const storeId = col.id.slice('store:'.length)
        return (
          <TableCell key={col.id} className="numeric">
            <QtyCell
              tracked={row.type === 'INVENTORY'}
              quantity={row.storeQty?.[storeId] ?? '0.00'}
            />
          </TableCell>
        )
      }
    }
  }

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

      <div className="flex justify-end border-b px-3 py-2 print:hidden">
        <TableColumnCustomize columns={catalog} prefs={prefs} onToggle={toggle} onReorder={reorder} />
      </div>

      <ScrollSheet>
        <Table>
          <TableHeader>
            <TableRow className="ledger-head hover:bg-[var(--band)]">
              {canArchive ? (
                <TableHead className="w-10 bg-[var(--band)]">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 rounded border-input"
                  />
                </TableHead>
              ) : null}
              {visible.map((col) => renderHeader(col))}
              <TableHead className="w-10 bg-[var(--band)]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <ClickableRow
                key={row.id}
                href={`/items/${row.id}/report`}
                title={`Open report for ${row.name}`}
                className={cn(
                  index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row',
                  !row.isActive && 'opacity-55',
                )}
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
                {visible.map((col) => renderCell(row, col))}
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
              </ClickableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollSheet>

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

