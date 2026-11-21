'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { COMPANY_SNAPSHOT_HREF } from '@/lib/business-overview-access'

export function CustomerPicker({
  customers,
  selectedId,
}: {
  customers: { id: string; name: string }[]
  selectedId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((row) => row.name.toLowerCase().includes(q))
  }, [customers, query])

  const go = (id: string) => {
    const href = id
      ? `${COMPANY_SNAPSHOT_HREF}?tab=customer&customerId=${encodeURIComponent(id)}`
      : `${COMPANY_SNAPSHOT_HREF}?tab=customer`
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Search
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a customer name…"
          className="rounded-md border bg-background px-2.5 py-1.5"
          autoComplete="off"
        />
      </label>
      <label className="flex min-w-[16rem] flex-[2] flex-col gap-1 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Customer
        </span>
        <select
          className="rounded-md border bg-background px-2.5 py-1.5"
          value={selectedId ?? ''}
          disabled={pending || filtered.length === 0}
          onChange={(event) => go(event.target.value)}
        >
          <option value="">Select a customer…</option>
          {filtered.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {pending ? <span className="pb-2 text-xs text-muted-foreground">Loading…</span> : null}
      {query && filtered.length === 0 ? (
        <p className="pb-2 text-xs text-muted-foreground">No matches for “{query}”.</p>
      ) : null}
    </div>
  )
}
