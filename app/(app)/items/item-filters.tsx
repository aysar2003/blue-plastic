'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { NativeSelect } from '@/components/ui/native-select'

export function ItemFilters({
  types,
  units,
}: {
  types: { value: string; label: string }[]
  units: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = searchParams.get('type') ?? ''
  const unit = searchParams.get('unit') ?? ''

  function apply(next: { type?: string; unit?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const typeValue = next.type ?? type
    const unitValue = next.unit ?? unit
    if (typeValue) params.set('type', typeValue)
    else params.delete('type')
    if (unitValue) params.set('unit', unitValue)
    else params.delete('unit')
    params.delete('page')
    const text = params.toString()
    router.replace(text ? `/items?${text}` : '/items', { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Type
        <NativeSelect
          aria-label="Item type"
          value={type}
          onChange={(event) => apply({ type: event.target.value })}
          className="w-44"
        >
          <option value="">All types</option>
          {types.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Unit
        <NativeSelect
          aria-label="Unit of measure"
          value={unit}
          onChange={(event) => apply({ unit: event.target.value })}
          className="w-40"
        >
          <option value="">All units</option>
          <option value="__none__">No unit</option>
          {units.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
    </div>
  )
}
