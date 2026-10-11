'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { RotateCcwIcon, SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Pushes the query into the URL so the server re-renders the list.
 * Deliberately not a client-side filter: the table is paginated on the server
 * and filtering only the current page would quietly lie about the results.
 *
 * Search and Reset are explicit buttons (Enter also searches). Auto-debounce is
 * off so the list only changes when the person asks.
 */
export function SearchInput({
  placeholder = 'Search…',
  className,
}: {
  placeholder?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setValue(urlQuery)
  }, [urlQuery])

  const apply = (nextQuery: string) => {
    const next = new URLSearchParams(searchParams.toString())
    const trimmed = nextQuery.trim()
    if (trimmed) next.set('q', trimmed)
    else next.delete('q')
    next.delete('page')
    const text = next.toString()
    startTransition(() =>
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }),
    )
  }

  const canReset = Boolean(value.trim() || urlQuery.trim())

  return (
    <form
      className={cn('flex w-full max-w-xl flex-wrap items-center gap-1.5', className)}
      onSubmit={(event) => {
        event.preventDefault()
        apply(value)
      }}
    >
      <div className="relative min-w-[12rem] flex-1">
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-busy={isPending}
          className="pl-7"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canReset || isPending}
        onClick={() => {
          setValue('')
          apply('')
        }}
      >
        <RotateCcwIcon />
        Reset
      </Button>
      <Button type="submit" size="sm" disabled={isPending}>
        <SearchIcon />
        Search
      </Button>
    </form>
  )
}
