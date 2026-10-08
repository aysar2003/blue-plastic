'use client'

import { StockWarningNote } from '@/components/inventory/stock-warning'
import { NativeSelect } from '@/components/ui/native-select'
import { shortStockNote, type StockByStore, type StockWarning, type StoreChoice } from '@/lib/store-stock'
import { cn } from '@/lib/utils'

export function LineStore({
  stores,
  stock,
  tracked,
  warn,
  warning,
  itemId,
  storeId,
  quantity,
  onChange,
  label,
  className,
}: {
  stores: StoreChoice[]
  stock: StockByStore
  tracked: boolean
  /** On a sale, say which store still has the item when this one is short. */
  warn: boolean
  /** Amber note when this sale takes the store to or below zero (never blocks). */
  warning?: StockWarning | null
  itemId: string
  storeId: string
  quantity: string
  onChange: (storeId: string) => void
  label: string
  className?: string
}) {
  if (stores.length === 0) return null
  const note = warn && tracked ? shortStockNote(stores, stock, itemId, storeId, quantity) : null
  const places = itemId ? (stock[itemId] ?? {}) : {}
  return (
    <div className={className}>
      <NativeSelect
        aria-label={label}
        value={storeId}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 border-transparent bg-transparent px-1 text-xs"
      >
        {stores.map((store) => {
          const onHand = tracked && itemId ? Number(places[store.id] ?? '0') : null
          const qtyLabel =
            onHand == null || !Number.isFinite(onHand)
              ? store.name
              : `${store.name} (${onHand.toFixed(onHand % 1 === 0 ? 0 : 2)})`
          return (
            <option key={store.id} value={store.id}>
              {qtyLabel}
            </option>
          )
        })}
      </NativeSelect>
      <StockWarningNote warning={warning} className="max-w-48" />
      {note ? <p className="mt-1 max-w-48 text-[11px] leading-snug text-[#C2410C]">{note}</p> : null}
    </div>
  )
}

export function storeQtyClass(quantity: string) {
  const value = Number(quantity)
  if (value < 0) return 'text-[#C2410C]'
  if (value === 0) return 'text-muted-foreground'
  return ''
}

export function QtyCell({ quantity, tracked }: { quantity: string; tracked: boolean }) {
  if (!tracked) return <span className="text-muted-foreground">—</span>
  return <span className={cn('tabular', storeQtyClass(quantity))}>{quantity}</span>
}
