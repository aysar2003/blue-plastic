'use client'

import { PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

export type ComponentRow = { itemId: string; quantity: string }
export type CatalogItem = { id: string; label: string; type?: string }

export function ItemComponentsEditor({
  rows,
  onChange,
  catalog,
  label,
}: {
  rows: ComponentRow[]
  onChange: (next: ComponentRow[]) => void
  catalog: CatalogItem[]
  label: string
}) {
  const setRow = (index: number, patch: Partial<ComponentRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">Item</th>
              <th className="w-24 px-2 py-1.5 font-medium">Qty</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                <td className="px-2 py-1">
                  <NativeSelect
                    value={row.itemId}
                    onChange={(event) => setRow(index, { itemId: event.target.value })}
                    className="h-8"
                  >
                    <option value="">— choose —</option>
                    {catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={row.quantity}
                    onChange={(event) => setRow(index, { quantity: event.target.value })}
                    inputMode="decimal"
                    className="h-8 tabular"
                  />
                </td>
                <td className="px-1 py-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    aria-label="Remove line"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...rows, { itemId: '', quantity: '1' }])}
      >
        <PlusIcon className="size-3.5" />
        Add line
      </Button>
      <input type="hidden" name="componentsJson" value={JSON.stringify(rows.filter((r) => r.itemId))} />
    </div>
  )
}
