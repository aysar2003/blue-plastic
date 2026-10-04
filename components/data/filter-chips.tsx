import Link from 'next/link'

import { listHref } from '@/lib/list-filters'

export function FilterChips({
  options,
  active,
  path,
  param,
  params,
}: {
  options: { value: string; label: string }[]
  active: string
  path: string
  param: string
  /** The other filters already chosen. This row replaces `param`. */
  params: Record<string, string | undefined>
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const on = active === option.value
        return (
          <Link
            key={option.label}
            href={listHref(path, { ...params, [param]: option.value || undefined })}
            aria-current={on ? 'page' : undefined}
            className={
              on
                ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                : 'rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border hover:bg-accent'
            }
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}
