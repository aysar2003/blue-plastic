'use client'

import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

/** A filter that rewrites one query parameter and keeps the rest. */
export function QuerySelect({
  param,
  value,
  options,
  path,
  hidden,
  label,
  className,
}: {
  param: string
  value: string
  options: { value: string; label: string }[]
  path: string
  hidden?: Record<string, string | undefined>
  label: string
  className?: string
}) {
  const router = useRouter()

  return (
    <label className="flex items-center gap-2 text-sm">
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <select
        aria-label={label}
        className={cn('h-8 rounded-md border bg-card px-2 text-sm', className)}
        value={value}
        onChange={(event) => {
          const search = new URLSearchParams()
          for (const [key, item] of Object.entries(hidden ?? {})) {
            if (item) search.set(key, item)
          }
          if (event.target.value) search.set(param, event.target.value)
          const query = search.toString()
          router.push(query ? `${path}?${query}` : path)
        }}
      >
        {options.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
