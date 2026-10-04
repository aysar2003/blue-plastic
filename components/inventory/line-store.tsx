'use client'

import { NativeSelect } from '@/components/ui/native-select'
import { shortStockNote, type StockByStore, type StoreChoice } from '@/lib/store-stock'
import { cn } from '@/lib/utils'

export function LineStore({
  stores,
  stock,
  tracked,
  warn,
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
  itemId: string
  storeId: string
  quantity: string
  onChange: (storeId: string) => void
  label: string
  className?: string
}) {
  if (stores.length === 0) return null
  const note = warn && tracked ? shortStockNote(stores, stock, itemId, storeId, quantity) : null
  return (
    <div className={className}>
      <NativeSelect
        aria-label={label}
        value={storeId}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 border-transparent bg-transparent px-1 text-xs"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </NativeSelect>
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
