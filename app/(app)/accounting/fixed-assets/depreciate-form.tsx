'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { runDepreciation } from './actions'

export function DepreciateForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          const result = await runDepreciation({ month })
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          toast.success(`Posted depreciation for ${result.data.posted} asset(s).`)
          router.refresh()
        })
      }}
    >
      <label className="text-xs">
        Month
        <Input type="date" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Posting…' : 'Depreciate'}
      </Button>
    </form>
  )
}
