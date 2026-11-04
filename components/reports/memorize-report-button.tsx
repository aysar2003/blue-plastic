'use client'

import { useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { BookmarkIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { memorizeReport } from '@/app/(app)/reports/memorize-actions'

/**
 * Save this report URL (period, basis, comparison, filters) under a name.
 * Opens again from Reports → Custom reports (Phase 11.15).
 */
export function MemorizeReportButton({ title }: { title?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const defaultLabel = () => {
    if (title?.trim()) return title.trim()
    if (typeof document !== 'undefined') {
      return document.title.replace(/\s*[·|].*$/, '').trim() || 'Saved report'
    }
    return 'Saved report'
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="print:hidden"
      disabled={pending || saved}
      title="Save period, basis, and comparison under a name"
      onClick={() => {
        const label = window.prompt(
          'Name this report view (period and filters are kept in the link)',
          defaultLabel(),
        )
        if (!label?.trim()) return

        const href = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
        startTransition(async () => {
          const result = await memorizeReport({ label: label.trim(), href })
          if (result.ok) {
            setSaved(true)
            toast.success('Saved under Custom reports.')
          } else {
            toast.error(result.error)
          }
        })
      }}
    >
      {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <BookmarkIcon className="size-3.5" />}
      {saved ? 'Saved' : 'Save view'}
    </Button>
  )
}
