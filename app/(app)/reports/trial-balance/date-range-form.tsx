'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'

export function DateRangeForm({
  from,
  to,
  extraParams,
}: {
  from: string
  to: string
  /** Other query keys to keep when applying the range (e.g. source, sort). */
  extraParams?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)

  return (
    <form
      className="flex flex-wrap items-end gap-3 print:hidden"
      onSubmit={(event) => {
        event.preventDefault()
        const search = new URLSearchParams()
        search.set('from', start)
        search.set('to', end)
        if (extraParams) {
          for (const [key, value] of Object.entries(extraParams)) {
            if (value) search.set(key, value)
          }
        }
        router.push(`?${search.toString()}`)
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <DateField id="from" value={start} onChange={setStart} className="w-44" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <DateField id="to" value={end} onChange={setEnd} className="w-44" />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  )
}
