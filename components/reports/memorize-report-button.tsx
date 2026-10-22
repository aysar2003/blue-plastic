'use client'

import { useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { BookmarkIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { memorizeReport } from '@/app/(app)/reports/memorize-actions'

/** Save the current report URL as a memorized favourite (QBD-style). */
export function MemorizeReportButton({ title }: { title: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || saved}
        onClick={() => {
          setError(null)
          const href = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
          startTransition(async () => {
            const result = await memorizeReport({ label: title, href })
            if (result.ok) setSaved(true)
            else setError(result.error)
          })
        }}
      >
        {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <BookmarkIcon className="size-3.5" />}
        {saved ? 'Memorized' : 'Memorize'}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
