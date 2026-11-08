'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * QuickBooks-style Back / Forward between saved records of one document type.
 *
 * Back opens the previous saved row (or the newest when the form is blank).
 * Forward opens the next row, or a blank /new form when standing on the newest.
 *
 * Href building lives in `@/lib/record-nav` so server pages can call it too.
 */
export function RecordNav({
  previousHref,
  forwardHref,
  previousTitle,
  forwardTitle,
}: {
  previousHref: string | null
  forwardHref: string | null
  previousTitle?: string
  forwardTitle?: string
}) {
  const router = useRouter()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!previousHref}
        title={previousTitle ?? (previousHref ? 'Back to previous record' : 'No earlier record')}
        onClick={() => previousHref && router.push(previousHref)}
      >
        <ChevronLeftIcon />
        Back
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!forwardHref}
        title={forwardTitle ?? (forwardHref ? 'Forward to next record' : 'No later record')}
        onClick={() => forwardHref && router.push(forwardHref)}
      >
        Forward
        <ChevronRightIcon />
      </Button>
    </>
  )
}
